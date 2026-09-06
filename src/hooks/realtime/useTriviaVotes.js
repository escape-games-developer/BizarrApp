import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, supabaseAnon } from "../../lib/supabase";

const EMPTY_TOTALS = { batata_votes:0, membrillo_votes:0, batata_correct:0, membrillo_correct:0, opt_0:0, opt_1:0, opt_2:0, opt_3:0, total_votes:0 };

// Cada cuánto se relee la vista de totales mientras hay ronda viva.
// Realtime sobre trivia_votes ya no alcanza: desde el hardening de RLS la tabla
// solo es legible por su propio autor, asi que /pantalla (anon) y Admin no
// reciben los INSERT de terceros. Las vistas trivia_totals y
// trivia_questions_public si estan grantadas a anon, y son la fuente real.
const POLL_MS = 2500;

export function useTriviaVotes(sessionId, roundId, questionIdx, triviaState) {
  const [totals,setTotals]=useState(null); const [loading,setLoading]=useState(true); const debounceRef=useRef(null);
  const fetchTotals=useCallback(async()=>{
    if(!sessionId||!roundId){setTotals(EMPTY_TOTALS);setLoading(false);return;}
    const {data,error}=await supabaseAnon.from("trivia_totals").select("*").eq("session_id",sessionId).eq("round_id",roundId).eq("question_idx",questionIdx).maybeSingle();
    if(error) console.warn("[useTriviaVotes] Totals error:",error.code);
    setTotals(data||EMPTY_TOTALS); setLoading(false);
  },[sessionId,roundId,questionIdx]);
  const debouncedFetch=useCallback(()=>{clearTimeout(debounceRef.current);debounceRef.current=setTimeout(fetchTotals,300);},[fetchTotals]);
  // triviaState en deps: al pasar a 'revealed' la vista recien expone los aciertos.
  useEffect(()=>{fetchTotals();},[fetchTotals,triviaState]);
  useEffect(()=>{
    if(!sessionId||!roundId)return undefined;
    const poll=setInterval(fetchTotals,POLL_MS);
    const channel=supabaseAnon.channel(`trivia-votes-${sessionId}-${roundId}-q${questionIdx}`).on("postgres_changes",{event:"INSERT",schema:"public",table:"trivia_votes",filter:`session_id=eq.${sessionId}`},payload=>{
      if(payload.new.round_id===roundId&&payload.new.question_idx===questionIdx)debouncedFetch();
    }).subscribe();
    return()=>{clearInterval(poll);clearTimeout(debounceRef.current);supabaseAnon.removeChannel(channel);};
  },[sessionId,roundId,questionIdx,fetchTotals,debouncedFetch]);
  const pcts=totals?{batata:totals.total_votes?Math.round(totals.batata_votes/totals.total_votes*100):50,membrillo:totals.total_votes?Math.round(totals.membrillo_votes/totals.total_votes*100):50,opts:[0,1,2,3].map(i=>totals.total_votes?Math.round(totals[`opt_${i}`]/totals.total_votes*100):0)}:null;
  return{totals,pcts,loading,refresh:fetchTotals};
}

export function useTriviaQuestion(sessionId,roundId,questionIdx,triviaState){
  const [question,setQuestion]=useState(null);
  useEffect(()=>{
    if(!sessionId||!roundId){setQuestion(null);return undefined;} let cancelled=false;
    supabaseAnon.from("trivia_questions_public").select("question_text,options,correct_option").eq("session_id",sessionId).eq("round_id",roundId).eq("question_idx",questionIdx).maybeSingle().then(({data,error})=>{
      if(cancelled)return; if(error)console.warn("[useTriviaQuestion] Question error:",error.code);
      setQuestion(data?{text:data.question_text,options:data.options||[],correct:data.correct_option}:null);
    });
    return()=>{cancelled=true;};
  },[sessionId,roundId,questionIdx,triviaState]);
  return question;
}

export function useTriviaVoter(sessionId,roundId,questionIdx,userId,team){
  const [myVote,setMyVote]=useState(null); const [sending,setSending]=useState(false); const [error,setError]=useState(null);
  useEffect(()=>{
    setMyVote(null);setError(null);if(!sessionId||!roundId||!userId)return undefined;let cancelled=false;
    supabase.from("trivia_votes").select("option_idx").eq("session_id",sessionId).eq("round_id",roundId).eq("question_idx",questionIdx).eq("user_id",userId).maybeSingle().then(({data,error:fetchError})=>{
      if(cancelled)return;if(fetchError)setError("No pudimos recuperar tu voto.");else setMyVote(data?.option_idx??null);
    });return()=>{cancelled=true;};
  },[sessionId,roundId,questionIdx,userId]);
  const vote=useCallback(async optionIdx=>{
    if(myVote!==null||sending||!sessionId||!roundId||!userId||!team)return;
    setMyVote(optionIdx);setSending(true);setError(null);
    const {error:insertError}=await supabase.from("trivia_votes").insert({session_id:sessionId,round_id:roundId,question_idx:questionIdx,user_id:userId,team,option_idx:optionIdx});
    if(insertError){
      if(insertError.code==="23505"){
        const {data}=await supabase.from("trivia_votes").select("option_idx").eq("session_id",sessionId).eq("round_id",roundId).eq("question_idx",questionIdx).eq("user_id",userId).maybeSingle();
        setMyVote(data?.option_idx??null);setError(data?"Ya habías votado esta pregunta.":"No pudimos recuperar tu voto.");
      }else{setMyVote(null);setError("No pudimos enviar tu voto. Intentá de nuevo.");}
      console.warn("[useTriviaVoter] Vote error:",insertError.code);
    }
    setSending(false);
  },[myVote,sending,sessionId,roundId,questionIdx,userId,team]);
  return{myVote,vote,hasVoted:myVote!==null,sending,error};
}

export function useTriviaAccumulated(sessionId,roundId,triviaState){
  const [accumulated,setAccumulated]=useState({batata:0,membrillo:0});
  const fetchAll=useCallback(async()=>{if(!sessionId||!roundId)return;const {data}=await supabaseAnon.from("trivia_totals").select("batata_correct,membrillo_correct").eq("session_id",sessionId).eq("round_id",roundId);if(data)setAccumulated(data.reduce((a,r)=>({batata:a.batata+(r.batata_correct||0),membrillo:a.membrillo+(r.membrillo_correct||0)}),{batata:0,membrillo:0}));},[sessionId,roundId]);
  // Sin triviaState en deps los aciertos quedaban siempre en 0: la vista solo los
  // expone en 'revealed'/'finished' y despues del reveal ya no entran votos que
  // disparen un refetch, con lo que el ganador salia siempre "empate".
  useEffect(()=>{fetchAll();},[fetchAll,triviaState]);
  useEffect(()=>{
    if(!sessionId||!roundId)return undefined;
    const poll=setInterval(fetchAll,POLL_MS);
    const channel=supabaseAnon.channel(`trivia-accumulated-${sessionId}-${roundId}`).on("postgres_changes",{event:"INSERT",schema:"public",table:"trivia_votes",filter:`session_id=eq.${sessionId}`},fetchAll).subscribe();
    return()=>{clearInterval(poll);supabaseAnon.removeChannel(channel);};
  },[sessionId,roundId,fetchAll]);
  const total=accumulated.batata+accumulated.membrillo;const bataPct=total?Math.round(accumulated.batata/total*100):50;const membPct=total?100-bataPct:50;const leader=accumulated.batata===accumulated.membrillo?null:accumulated.batata>accumulated.membrillo?"batata":"membrillo";
  return{accumulated,bataPct,membPct,leader,refresh:fetchAll};
}
