import React from 'react';

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <>
      <style>{`
        .skp-main-layout {
          display: grid;
          grid-template-columns: minmax(0, 1.65fr) minmax(0, 360px);
          gap: 1rem;
          align-items: start;
          min-height: 0;
          width: 100%;
        }

        @media (max-width: 1024px) {
          .skp-main-layout {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
      <div className="skp-main-layout">{children}</div>
    </>
  );
}
