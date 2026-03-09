import { Icon } from "./Icon";
import styles from "./ShowcaseTeamGrid.module.css";

interface TeamMember {
  name: string;
  role: string;
  src?: string;
}

interface ShowcaseTeamGridProps {
  variant?: "square" | "circle";
  members: TeamMember[];
}

export function ShowcaseTeamGrid({
  variant = "circle",
  members,
}: ShowcaseTeamGridProps) {
  return (
    <div data-growable="" className={styles.root}>
      {members.map((member, i) => (
        <div key={i} className={styles.member}>
          <div
            className={`${styles.avatar} ${variant === "circle" ? styles.avatarCircle : ""}`}
          >
            {member.src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className={styles.avatarImage}
                src={member.src}
                alt={member.name}
              />
            ) : (
              <Icon
                name="user"
                size={64}
                color="var(--slide-text-subtle)"
              />
            )}
          </div>
          <p className={styles.name}>{member.name}</p>
          <p className={styles.role}>{member.role}</p>
        </div>
      ))}
    </div>
  );
}
