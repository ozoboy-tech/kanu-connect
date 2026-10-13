"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main><h1>Cette page est momentanément indisponible.</h1>
    <p role="alert">Nous n’avons pas pu charger les informations. Réessaie dans un instant.</p>
    <button type="button" onClick={reset}>Réessayer</button>{" "}
    <a href="/">Retour à l’accueil</a>
  </main>;
}