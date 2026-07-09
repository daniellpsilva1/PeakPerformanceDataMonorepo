import type { ReactNode } from "react";

interface FigureCardProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: string;
}

export function FigureCard({ title, subtitle, children, footer }: FigureCardProps) {
  return (
    <div className="figure-card">
      <div className="figure-card-header">
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
      <div className="figure-card-body">{children}</div>
      {footer && <p className="figure-card-footer">{footer}</p>}
    </div>
  );
}
