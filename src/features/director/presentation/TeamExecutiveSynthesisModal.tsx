import { useState, useMemo } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Sparkles, Trophy, AlertTriangle, Target, Building, Loader2, Download, Printer, CheckCircle, Calendar } from 'lucide-react';
import { generateTeamExecutiveBriefing, type ConsolidatedSynthesisResult } from '../services/TeamReportsConsolidatedAiService';
import type { V2WeeklyReport, User, Service } from '../../../context/AppContext';
import { toast } from 'react-hot-toast';

interface TeamExecutiveSynthesisModalProps {
  open: boolean;
  onClose: () => void;
  v2WeeklyReports: V2WeeklyReport[];
  users: User[];
  services: Service[];
  userId?: string;
}

export default function TeamExecutiveSynthesisModal({
  open,
  onClose,
  v2WeeklyReports,
  users,
  services,
  userId
}: TeamExecutiveSynthesisModalProps) {
  // Liste des semaines distinctes disponibles
  const availableWeeks = useMemo(() => {
    const set = new Set(v2WeeklyReports.map(r => r.weekStart));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [v2WeeklyReports]);

  const [selectedWeek, setSelectedWeek] = useState<string>(() => availableWeeks[0] || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [synthesis, setSynthesis] = useState<ConsolidatedSynthesisResult | null>(null);

  // Rapports pour la semaine sélectionnée
  const weekReports = useMemo(() => {
    if (!selectedWeek) return [];
    return v2WeeklyReports.filter(r => r.weekStart === selectedWeek);
  }, [v2WeeklyReports, selectedWeek]);

  const handleGenerate = async () => {
    if (weekReports.length === 0) {
      toast.error('Aucun rapport trouvé pour cette semaine.');
      return;
    }

    setIsGenerating(true);
    try {
      const res = await generateTeamExecutiveBriefing({
        reports: weekReports,
        users,
        services,
        weekStart: selectedWeek,
        userId
      });
      setSynthesis(res);
      toast.success('Briefing exécutif généré avec succès !');
    } catch (err: any) {
      toast.error('Erreur lors de la génération : ' + (err.message || err));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Synthèse IA Globale des Rapports d'Équipe (Direction)"
      width={720}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <Button variant="ghost" onClick={onClose}>
            Fermer
          </Button>

          {synthesis && (
            <Button
              variant="primary"
              onClick={() => window.print()}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Printer size={16} /> Imprimer / Exporter PDF
            </Button>
          )}
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {/* Week Selector Bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--color-surface-alt)',
          padding: '12px 16px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Calendar size={18} color="var(--color-primary)" />
            <span style={{ fontSize: '13px', fontWeight: 600 }}>Semaine d'activité :</span>
            <select
              value={selectedWeek}
              onChange={e => {
                setSelectedWeek(e.target.value);
                setSynthesis(null);
              }}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                fontWeight: 600,
                fontSize: '13px'
              }}
            >
              {availableWeeks.map(w => (
                <option key={w} value={w}>
                  Semaine du {new Date(w + 'T00:00:00').toLocaleDateString('fr-FR')}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
              <b>{weekReports.length}</b> rapport(s) soumis
            </span>

            <Button
              variant="primary"
              onClick={handleGenerate}
              disabled={isGenerating || weekReports.length === 0}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' }}
            >
              {isGenerating ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Synthèse en cours...
                </>
              ) : (
                <>
                  <Sparkles size={16} /> Générer le Briefing IA
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Synthesis Body */}
        {synthesis ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Executive Summary Card */}
            <div style={{
              padding: '16px 20px',
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(180deg, #FAF5FF 0%, #F3E8FF 100%)',
              border: '1px solid #D8B4FE',
              color: '#4C1D95'
            }}>
              <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} color="#7C3AED" /> Synthèse Exécutive de la Direction
              </div>
              <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
                {synthesis.executiveSummary}
              </div>
            </div>

            {/* Grid Achievements & Roadblocks */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              {/* Achievements */}
              <div style={{ padding: '14px 16px', borderRadius: 'var(--radius-md)', background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                <div style={{ fontWeight: 700, fontSize: '14px', color: '#166534', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Trophy size={16} color="#16A34A" /> Réalisations Clés de l'Équipe
                </div>
                {synthesis.majorAchievements.length === 0 ? (
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Aucune réalisation spécifique renseignée.</div>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', lineHeight: '1.6', color: '#14532D' }}>
                    {synthesis.majorAchievements.map((item, idx) => (
                      <li key={idx} style={{ marginBottom: '4px' }}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Roadblocks & Direction Arbitration */}
              <div style={{ padding: '14px 16px', borderRadius: 'var(--radius-md)', background: '#FEF2F2', border: '1px solid #FECACA' }}>
                <div style={{ fontWeight: 700, fontSize: '14px', color: '#991B1B', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={16} color="#DC2626" /> Blocages & Arbitrages Direction
                </div>
                {synthesis.criticalRoadblocks.length === 0 ? (
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Aucun blocage critique à signaler.</div>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', lineHeight: '1.6', color: '#7F1D1D' }}>
                    {synthesis.criticalRoadblocks.map((item, idx) => (
                      <li key={idx} style={{ marginBottom: '4px' }}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Strategic Objectives Next Week */}
            {synthesis.strategicObjectives.length > 0 && (
              <div style={{ padding: '14px 16px', borderRadius: 'var(--radius-md)', background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)' }}>
                <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Target size={16} color="var(--color-primary)" /> Priorités Stratégiques Consolidées (Semaine N+1)
                </div>
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', lineHeight: '1.6' }}>
                  {synthesis.strategicObjectives.map((obj, idx) => (
                    <li key={idx} style={{ marginBottom: '4px' }}>{obj}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-muted)' }}>
            <Sparkles size={40} color="#7C3AED" style={{ margin: '0 auto 12px', opacity: 0.6 }} />
            <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--color-text)' }}>
              Aucun briefing généré pour cette semaine
            </div>
            <div style={{ fontSize: '13px', marginTop: '4px' }}>
              Cliquez sur <b>« Générer le Briefing IA »</b> pour compiler automatiquement tous les rapports de vos collaborateurs.
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
