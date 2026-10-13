export default function AppealPage() {
  const raw = process.env.KANU_APPEAL_EMAIL ?? "";
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw) ? raw : null;
  return <main><p><a href="/">Accueil</a></p>
    <h1>Contester une suspension</h1>
    <p>Si l’accès à ton compte est suspendu, tu peux demander un réexamen.
      Indique le pseudo concerné et explique la situation. N’envoie jamais ton mot de passe.</p>
    {email ? <p><a href={`mailto:${email}?subject=${encodeURIComponent("Réexamen Kanu Connect")}`}>
      Envoyer ma demande à {email}</a></p>
      : <p>Le contact de réexamen n’est pas encore configuré. Contacte l’équipe
        par le canal d’assistance habituel.</p>}
  </main>;
}
