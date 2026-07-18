import { useAppContext } from './context/AppContext';
import UploadZone from './components/UploadZone';
import ErrorBanner from './components/ErrorBanner';
import LoadingOverlay from './components/LoadingOverlay';
import { ThreeViewport } from './components/ThreeViewport';
import { ViewSelector } from './components/ViewSelector';
import AnnotationPanel from './components/AnnotationPanel';
import { ThumbnailPreviewPanel } from './components/ThumbnailPreviewPanel';
import ExportButton from './components/ExportButton';
import { MainLayout } from './layouts/MainLayout';

function App() {
  const { state } = useAppContext();
  const hasModel = state.model !== null && state.parseStatus === 'success';

  return (
    <main
      style={{
        minHeight: '100vh',
        fontFamily: 'Inter, system-ui, sans-serif',
        backgroundColor: '#f8fafc',
        color: '#111827',
      }}
    >
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '1.5rem 1rem 2rem' }}>
        <header style={{ marginBottom: '1.5rem' }}>
          <p style={{ margin: '0 0 0.5rem', color: '#6b7280', fontSize: '0.95rem' }}>
            Upload a SketchUp (.skp) file to preview the model and export a PDF.
          </p>
          <h1 style={{ margin: 0, fontSize: 'clamp(2rem, 3vw, 2.75rem)', lineHeight: 1.05 }}>
            SketchUp to PDF Converter
          </h1>
        </header>

        <section style={{ marginBottom: '1.5rem' }}>
          <UploadZone />
        </section>

        <ErrorBanner />
        <LoadingOverlay />

        <MainLayout>
          <section
            style={{
              minHeight: '560px',
              borderRadius: '1rem',
              overflow: 'hidden',
              backgroundColor: '#ffffff',
              boxShadow: '0 18px 50px rgba(15, 23, 42, 0.08)',
            }}
          >
            {hasModel ? (
              <ThreeViewport />
            ) : (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#475569' }}>
                <p style={{ margin: 0, fontSize: '1rem' }}>
                  Upload and parse an SKP file to display the 3D preview.
                </p>
              </div>
            )}
          </section>

          <aside style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <ViewSelector />
            <AnnotationPanel />
            <ThumbnailPreviewPanel />
            <ExportButton />
          </aside>
        </MainLayout>
      </div>
    </main>
  );
}

export default App;
