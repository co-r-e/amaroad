import styles from "./ShowcaseDiagram.module.css";

interface ShowcaseDiagramProps {
  children: React.ReactNode;
}

export function ShowcaseDiagram({ children }: ShowcaseDiagramProps) {
  return (
    <div className={styles.container} data-growable="">
      {children}
    </div>
  );
}
