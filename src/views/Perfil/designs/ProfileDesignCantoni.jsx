import ProfileDesignOriginal from "./ProfileDesignOriginal";
import { CANTONI_PROFILE_SKIN as skin } from "./profileSkins";

/**
 * Diseño Cantoni de "Mi Perfil": la misma estructura que el Diseño Jorge
 * (ProfileDesignOriginal) con la piel Talento Bizarren, sobre su lienzo de
 * noche y con la franja de señal de TV arriba.
 */
export default function ProfileDesignCantoni({ profile }) {
  return (
    <div className={skin.className}>
      <style>{skin.fontsCss}</style>
      <style>{skin.css}</style>
      <div className="prf-tv-franja" aria-hidden="true">
        {skin.tvStripe.map((c, i) => <span key={i} style={{ background: c }}/>)}
      </div>
      <div className="prf-cuerpo">
        <ProfileDesignOriginal profile={profile} skin={skin}/>
      </div>
    </div>
  );
}
