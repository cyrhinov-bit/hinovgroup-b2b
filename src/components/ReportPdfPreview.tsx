import { Download } from 'lucide-react';
import { Modal } from './ui/Modal';
import { downloadDataUrl } from '../lib/pdfUtils';

export interface ReportPdfPreviewData {
  dataUrl: string;
  filename: string;
  title: string;
}

interface ReportPdfPreviewProps {
  preview: ReportPdfPreviewData | null;
  onClose: () => void;
}

export function ReportPdfPreview({ preview, onClose }: ReportPdfPreviewProps) {
  return (
    <Modal
      open={!!preview}
      title={preview?.title || 'Aperçu du rapport'}
      onClose={onClose}
      width={860}
      footer={
        preview && (
          <button
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center' }}
            onClick={() => downloadDataUrl(preview.dataUrl, preview.filename)}
          >
            <Download size={16} style={{ marginRight: '8px' }} /> Télécharger PDF
          </button>
        )
      }
    >
      {preview && (
        <iframe
          src={preview.dataUrl}
          title={preview.title}
          style={{ width: '100%', height: '72vh', border: '1px solid var(--color-border)', borderRadius: '8px' }}
        />
      )}
    </Modal>
  );
}