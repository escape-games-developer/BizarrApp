-- Desafío Demente: el acumulado del equipo ganador contaba sólo la última
-- pregunta (prueba de carga 2026-10-28: Membrillo 50 aciertos y Batata 13, y
-- la app declaraba ganador a Batata).
--
-- `trivia_totals` cruzaba los votos con `game_state` por la pregunta ACTUAL
-- (`gs.trivia_question = v.question_idx`): al pasar a la siguiente, las
-- anteriores se quedaban sin estado y sus aciertos volvían NULL.
-- useTriviaAccumulated suma batata_correct/membrillo_correct de todas las
-- preguntas de la ronda, así que perdía todo lo jugado antes.
--
-- Ahora el cruce es por ronda y los aciertos de una pregunta se muestran cuando:
--   · ya quedó atrás (question_idx < trivia_question), o
--   · es la actual y ya se reveló (revealed / finished), o
--   · la partida terminó.
-- La actual sigue oculta mientras se vota, igual que antes. Mismas columnas y
-- tipos: CREATE OR REPLACE sin tocar a quien la lee.

create or replace view public.trivia_totals with (security_barrier = true, security_invoker = false) as
select v.session_id,
       v.round_id,
       v.question_idx,
       count(*) filter (where v.team = 'batata')    as batata_votes,
       count(*) filter (where v.team = 'membrillo') as membrillo_votes,
       count(*) filter (where v.option_idx = 0)     as opt_0,
       count(*) filter (where v.option_idx = 1)     as opt_1,
       count(*) filter (where v.option_idx = 2)     as opt_2,
       count(*) filter (where v.option_idx = 3)     as opt_3,
       count(*)                                     as total_votes,
       case when gs.trivia_state = 'finished'
              or v.question_idx < gs.trivia_question
              or (v.question_idx = gs.trivia_question and gs.trivia_state in ('revealed', 'finished'))
            then count(*) filter (where v.team = 'batata' and v.option_idx = q.correct_option)
            else null::bigint
       end as batata_correct,
       case when gs.trivia_state = 'finished'
              or v.question_idx < gs.trivia_question
              or (v.question_idx = gs.trivia_question and gs.trivia_state in ('revealed', 'finished'))
            then count(*) filter (where v.team = 'membrillo' and v.option_idx = q.correct_option)
            else null::bigint
       end as membrillo_correct
  from trivia_votes v
  left join trivia_questions q
         on q.session_id = v.session_id and q.round_id = v.round_id and q.question_idx = v.question_idx
  left join game_state gs
         on gs.session_id = v.session_id and gs.trivia_round_id = v.round_id
 group by v.session_id, v.round_id, v.question_idx, gs.trivia_state, gs.trivia_question, q.correct_option;
