import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "./Icon";
import styles from "./ProcessFlow.module.css";

interface ProcessFlowProps {
  children: ReactNode;
  style?: React.CSSProperties;
}

export function ProcessFlow({ children, style }: ProcessFlowProps) {
  return (
    <div data-growable="" className={styles.flow} style={style}>
      {children}
    </div>
  );
}

interface FlowStepProps {
  title: string;
  children?: ReactNode;
  icon?: string;
  color?: string;
  active?: boolean;
  style?: React.CSSProperties;
}

export function FlowStep({
  title,
  children,
  icon,
  color,
  active,
  style,
}: FlowStepProps) {
  const accentColor = color ?? "var(--slide-primary)";

  return (
    <div
      className={cn(styles.step, active && styles.active)}
      style={{
        ...style,
        ...(active ? { borderColor: accentColor } : {}),
      }}
    >
      {icon && (
        <div className={styles.icon} style={{ color: accentColor }}>
          <Icon name={icon} size={32} />
        </div>
      )}
      <p className={styles.title}>{title}</p>
      {children && <div className={styles.content}>{children}</div>}
    </div>
  );
}
