import { EmptyState } from "@/app/components/ui";

export default function NotFound() {
  return <main><EmptyState title="Ce contenu n’est pas disponible."
    href="/explore?kind=posts" action="Retour à Explorer">
    Le lien peut avoir changé ou le contenu ne plus être accessible.
  </EmptyState></main>;
}
