import { useState, useEffect } from 'react';
import { Download, Printer, FileText, ExternalLink } from 'lucide-react';
import { Modal } from './ui/Modal';
import { downloadDataUrl } from '../lib/pdfUtils';

export interface ReportPdfPreviewData {
  dataUrl?: string;
  blobUrl?: string;
  filename: string;
  title: string;
  onDownload?: () => void;
}

interface ReportPdfPreviewProps {
  preview: ReportPdfPreviewData | null;
  onClose: () => void;
}

export function ReportPdfPreview({ preview, onClose }: ReportPdfPreviewProps) {
  const [activeUrl, setActiveUrl] = useState<string>('');

  useEffect(() => {
    if (preview) {
      const url = preview.blobUrl || preview.dataUrl || '';
      setActiveUrl(url);
    } else {
      setActiveUrl('');
    }
  }, [preview]);

  const handleDownload = () => {
    if (!preview) return;
    if (preview.onDownload) {
      preview.onDownload();
    } else if (preview.blobUrl) {
      const a = document.createElement('a');
      a.href = preview.blobUrl;
      a.download = preview.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else if (preview.dataUrl) {
      downloadDataUrl(preview.dataUrl, preview.filename);
    }
  };

  const handlePrint = () => {
    if (!activeUrl) return;
    const iframe = document.getElementById('report-pdf-iframe') as HTMLIFrameElement;
    if (iframe?.contentWindow) {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        return;
      } catch (err) {
        console.warn('Iframe print failed, falling back to window.open', err);
      }
    }
    const printWin = window.open(activeUrl, '_blank');
    printWin?.focus();
    printWin?.print();
  };

  const handleOpenExternal = () => {
    if (activeUrl) {
      window.open(activeUrl, '_blank');
    }
  };

  return (
    <Modal
      open={!!preview}
      title={preview?.title || 'Lecture du document PDF'}
      onClose={onClose}
      width={960}
      footer={
        preview && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
              <FileText size={16} />
              <span>{preview.filename}</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleOpenExternal}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                title="Ouvrir dans un nouvel onglet"
              >
                <ExternalLink size={15} /> Ouvrir plein écran
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handlePrint}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                title="Imprimer le document"
              >
                <Printer size={15} /> Imprimer
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleDownload}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                title="Télécharger une copie PDF"
              >
                <Download size={15} /> Télécharger PDF
              </button>
            </div>
          </div>
        )
      }
    >
      {preview && activeUrl ? (
        <div style={{ width: '100%', height: '75vh', backgroundColor: '#334155', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
          <object
            data={`${activeUrl}#toolbar=1&navpanes=0`}
            type="application/pdf"
            width="100%"
            height="100%"
            style={{ display: 'block', width: '100%', height: '100%' }}
          >
            <embed
              src={`${activeUrl}#toolbar=1`}
              type="application/pdf"
              width="100%"
              height="100%"
            />
            <iframe
              id="report-pdf-iframe"
              src={activeUrl}
              title={preview.title}
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
          </object>
        </div>
      ) : (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          Chargement du document PDF en cours...
        </div>
      )}
    </Modal>
  );
}