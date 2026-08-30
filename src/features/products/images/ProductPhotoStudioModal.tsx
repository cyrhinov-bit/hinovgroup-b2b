import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Camera, Upload, X, Check, Wand2, RotateCw, Sliders, 
  Sparkles, RefreshCw, Eye, Image as ImageIcon, CheckCircle2,
  SwitchCamera, AlertCircle, Save
} from 'lucide-react';
import type { PosProduct } from '../../../context/AppContext';
import { useAppContext } from '../../../context/AppContext';
import { enhanceProductImage, type EnhanceOptions, PRESET_CONFIGS } from '../../../lib/imageEnhancer';
import { supabase } from '../../../lib/supabase';
import { db } from '../../../lib/db';
import { toast } from 'react-hot-toast';

interface ProductPhotoStudioModalProps {
  product: PosProduct | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (updated: PosProduct) => void;
}

type Mode = 'select' | 'camera' | 'edit' | 'saving';

export function ProductPhotoStudioModal({
  product,
  isOpen,
  onClose,
  onSaved
}: ProductPhotoStudioModalProps) {
  const { updatePosProduct } = useAppContext();

  const [mode, setMode] = useState<Mode>('select');
  const [rawImageSource, setRawImageSource] = useState<string | null>(null);
  const [processedDataUrl, setProcessedDataUrl] = useState<string | null>(null);
  const [processedBlob, setProcessedBlob] = useState<Blob | null>(null);
  const [fileSizeKb, setFileSizeKb] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);

  // Options d'amélioration
  const [preset, setPreset] = useState<EnhanceOptions['preset']>('auto');
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(0);
  const [sharpen, setSharpen] = useState(3);
  const [whiteBoost, setWhiteBoost] = useState(20);
  const [rotation, setRotation] = useState(0);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  // Caméra
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialisation à l'ouverture
  useEffect(() => {
    if (isOpen && product) {
      if (product.imageUrl) {
        setRawImageSource(product.imageUrl);
        setMode('edit');
      } else {
        setMode('select');
        setRawImageSource(null);
      }
      setPreset('auto');
      setRotation(0);
    }
  }, [isOpen, product]);

  // Arrêter la caméra lors de la fermeture
  const stopCameraStream = useCallback(() => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(t => t.stop());
      cameraStreamRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      stopCameraStream();
    }
    return () => {
      stopCameraStream();
    };
  }, [isOpen, stopCameraStream]);

  // Démarrer la caméra
  const startCamera = async () => {
    setMode('camera');
    try {
      stopCameraStream();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 1280 }
        },
        audio: false
      });
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Erreur accès caméra:', err);
      toast.error('Impossible d\'accéder à la caméra. Vérifiez les autorisations du navigateur.');
      setMode('select');
    }
  };

  // Basculer caméra avant / arrière
  const toggleFacingMode = () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    startCamera();
  };

  // Capturer une photo depuis le flux vidéo
  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    const size = Math.min(video.videoWidth || 640, video.videoHeight || 640);
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Centrer et recadrer en carré
      const startX = (video.videoWidth - size) / 2;
      const startY = (video.videoHeight - size) / 2;
      ctx.drawImage(video, startX, startY, size, size, 0, 0, size, size);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      stopCameraStream();
      setRawImageSource(dataUrl);
      setPreset('auto');
      setRotation(0);
      setMode('edit');
    }
  };

  // Sélectionner un fichier
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez sélectionner un fichier image valide (PNG, JPG, WEBP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setRawImageSource(dataUrl);
      setPreset('auto');
      setRotation(0);
      setMode('edit');
    };
    reader.readAsDataURL(file);
  };

  // Déclencher l'algorithme d'amélioration de l'image
  const processImage = useCallback(async () => {
    if (!rawImageSource) return;
    setIsProcessing(true);
    try {
      const options: EnhanceOptions = {
        preset,
        rotation,
        targetSize: 800,
        quality: 0.88
      };

      if (preset === 'none') {
        options.brightness = brightness;
        options.contrast = contrast;
        options.saturation = saturation;
        options.sharpen = sharpen;
        options.whiteBoost = whiteBoost;
      }

      const result = await enhanceProductImage(rawImageSource, options);
      setProcessedDataUrl(result.dataUrl);
      setProcessedBlob(result.blob);
      setFileSizeKb(Math.round(result.blob.size / 1024));
    } catch (err) {
      console.error('Erreur traitement image:', err);
      toast.error('Erreur lors du traitement visuel de l\'image.');
    } finally {
      setIsProcessing(false);
    }
  }, [rawImageSource, preset, brightness, contrast, saturation, sharpen, whiteBoost, rotation]);

  useEffect(() => {
    if (mode === 'edit' && rawImageSource) {
      processImage();
    }
  }, [mode, rawImageSource, preset, rotation, processImage]);

  // Choisir un preset prédéfini
  const applyPreset = (newPreset: EnhanceOptions['preset']) => {
    setPreset(newPreset);
    if (newPreset && newPreset !== 'none') {
      const cfg = PRESET_CONFIGS[newPreset];
      setBrightness(cfg.brightness);
      setContrast(cfg.contrast);
      setSaturation(cfg.saturation);
      setSharpen(cfg.sharpen);
      setWhiteBoost(cfg.whiteBoost);
    }
  };

  // Rotation 90°
  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  // Enregistrer et publier
  const handleSaveAndPublish = async () => {
    if (!product || !processedDataUrl || !processedBlob) return;
    setMode('saving');

    try {
      let finalImageUrl = processedDataUrl;

      // 1. Tenter d'uploader vers Supabase Storage si en ligne
      if (navigator.onLine) {
        try {
          const ext = processedBlob.type.includes('webp') ? 'webp' : 'jpg';
          const filename = `product_${product.id}_${Date.now()}.${ext}`;
          const filePath = `products/${product.id}/${filename}`;

          const { error: uploadErr } = await supabase.storage
            .from('product-images')
            .upload(filePath, processedBlob, { upsert: true, contentType: processedBlob.type });

          if (!uploadErr) {
            const { data: publicUrlData } = supabase.storage
              .from('product-images')
              .getPublicUrl(filePath);

            if (publicUrlData?.publicUrl) {
              finalImageUrl = publicUrlData.publicUrl;
            }
          }
        } catch (storageErr) {
          console.warn('Storage upload fallback:', storageErr);
        }
      }

      // 2. Mettre à jour le produit dans le state global et la base
      const updatedProduct: PosProduct = {
        ...product,
        imageUrl: finalImageUrl,
        updatedAt: new Date().toISOString()
      };

      await updatePosProduct(product.id, { imageUrl: finalImageUrl });

      // 3. Sauvegarder dans le cache local
      await db.posProducts.setItem('data', (await db.posProducts.getItem<PosProduct[]>('data') || []).map(p =>
        p.id === product.id ? updatedProduct : p
      ));

      toast.success(`Photo de "${product.name}" mise à jour et publiée au catalogue !`);
      if (onSaved) onSaved(updatedProduct);
      onClose();
    } catch (err) {
      console.error('Erreur sauvegarde photo:', err);
      toast.error('Erreur lors de la sauvegarde de la photo.');
      setMode('edit');
    }
  };

  if (!isOpen || !product) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        backdropFilter: 'blur(4px)'
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '560px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
          overflow: 'hidden',
          animation: 'scaleUp 0.2s ease-out'
        }}
      >
        {/* EN-TÊTE MODALE */}
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#F8FAFC'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <div style={{ backgroundColor: '#CCFBF1', color: '#0F766E', padding: '8px', borderRadius: '10px', display: 'flex' }}>
              <Wand2 size={20} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Studio Photo — {product.name}
              </h3>
              <span style={{ fontSize: '11px', color: '#64748B' }}>
                {product.reference ? `Réf: ${product.reference} • ` : ''}Optimisation e-commerce automatique
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: '#F1F5F9',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <X size={16} color="#475569" />
          </button>
        </div>

        {/* CORPS DE LA MODALE */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {/* 1. ÉCRAN DE SÉLECTION DU MODE DE CAPTURE */}
          {mode === 'select' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '24px' }}>
                Capturez une photo directement avec votre téléphone ou téléversez un fichier image.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
                <button
                  type="button"
                  onClick={startCamera}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    padding: '24px 16px',
                    borderRadius: '16px',
                    border: '2px dashed #0F766E',
                    backgroundColor: '#F0FDFA',
                    color: '#0F766E',
                    cursor: 'pointer',
                    transition: 'transform 0.15s'
                  }}
                >
                  <Camera size={36} />
                  <span style={{ fontWeight: 700, fontSize: '14px' }}>Prendre une photo</span>
                  <span style={{ fontSize: '11px', opacity: 0.8 }}>Caméra smartphone</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    padding: '24px 16px',
                    borderRadius: '16px',
                    border: '2px dashed #CBD5E1',
                    backgroundColor: '#F8FAFC',
                    color: '#475569',
                    cursor: 'pointer',
                    transition: 'transform 0.15s'
                  }}
                >
                  <Upload size={36} />
                  <span style={{ fontWeight: 700, fontSize: '14px' }}>Importer image</span>
                  <span style={{ fontSize: '11px', color: '#94A3B8' }}>PNG, JPG, WEBP</span>
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleFileSelect}
              />
            </div>
          )}

          {/* 2. ÉCRAN CAMÉRA DIRECTE AVEC CADRAGE CARRÉ */}
          {mode === 'camera' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  maxWidth: '360px',
                  aspectRatio: '1 / 1',
                  backgroundColor: '#000',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  marginBottom: '16px',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
                }}
              >
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />

                {/* Grille de composition carrée 1:1 */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    border: '2px solid rgba(255, 255, 255, 0.4)',
                    pointerEvents: 'none',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gridTemplateRows: '1fr 1fr 1fr'
                  }}
                >
                  <div style={{ borderRight: '1px solid rgba(255,255,255,0.2)', borderBottom: '1px solid rgba(255,255,255,0.2)' }} />
                  <div style={{ borderRight: '1px solid rgba(255,255,255,0.2)', borderBottom: '1px solid rgba(255,255,255,0.2)' }} />
                  <div style={{ borderBottom: '1px solid rgba(255,255,255,0.2)' }} />
                  <div style={{ borderRight: '1px solid rgba(255,255,255,0.2)', borderBottom: '1px solid rgba(255,255,255,0.2)' }} />
                  <div style={{ borderRight: '1px solid rgba(255,255,255,0.2)', borderBottom: '1px solid rgba(255,255,255,0.2)' }} />
                  <div style={{ borderBottom: '1px solid rgba(255,255,255,0.2)' }} />
                  <div style={{ borderRight: '1px solid rgba(255,255,255,0.2)' }} />
                  <div style={{ borderRight: '1px solid rgba(255,255,255,0.2)' }} />
                  <div />
                </div>

                {/* Bouton de bascule caméra avant/arrière */}
                <button
                  type="button"
                  onClick={toggleFacingMode}
                  style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    background: 'rgba(0, 0, 0, 0.5)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    backdropFilter: 'blur(4px)'
                  }}
                  title="Changer de caméra"
                >
                  <SwitchCamera size={18} />
                </button>
              </div>

              {/* Bouton Déclencheur */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <button
                  type="button"
                  onClick={() => { stopCameraStream(); setMode('select'); }}
                  style={{ background: 'none', border: 'none', color: '#64748B', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                >
                  Annuler
                </button>

                <button
                  type="button"
                  onClick={capturePhoto}
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    backgroundColor: '#0F766E',
                    border: '4px solid white',
                    boxShadow: '0 4px 15px rgba(15, 118, 110, 0.4)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white'
                  }}
                  title="Prendre la photo"
                >
                  <Camera size={28} />
                </button>
              </div>
            </div>
          )}

          {/* 3. ÉCRAN DE RETOUCHE & ENHANCER ALGORITHMIQUE */}
          {(mode === 'edit' || mode === 'saving') && (
            <div>
              {/* APERÇU DE L'IMAGE AVEC BOUTONS D'ACTION RAPIDE */}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  maxWidth: '300px',
                  aspectRatio: '1 / 1',
                  margin: '0 auto 16px auto',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '16px',
                  border: '1px solid #E2E8F0',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.06)'
                }}
              >
                <img
                  src={showOriginal ? rawImageSource! : (processedDataUrl || rawImageSource!)}
                  alt="Aperçu Studio"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />

                {/* Badge Info Format & Poids */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: '8px',
                    left: '8px',
                    backgroundColor: 'rgba(15, 23, 42, 0.75)',
                    color: 'white',
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '6px',
                    backdropFilter: 'blur(4px)'
                  }}
                >
                  800×800 • {fileSizeKb > 0 ? `${fileSizeKb} Ko` : 'WebP'}
                </div>

                {/* Bouton Voir l'Original (Maintien) */}
                <button
                  type="button"
                  onMouseDown={() => setShowOriginal(true)}
                  onMouseUp={() => setShowOriginal(false)}
                  onTouchStart={() => setShowOriginal(true)}
                  onTouchEnd={() => setShowOriginal(false)}
                  style={{
                    position: 'absolute',
                    top: '8px',
                    left: '8px',
                    backgroundColor: showOriginal ? '#0F766E' : 'rgba(255, 255, 255, 0.9)',
                    color: showOriginal ? 'white' : '#1E293B',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '4px 8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                  }}
                  title="Maintenir pour voir l'image brute"
                >
                  <Eye size={12} />
                  <span>{showOriginal ? 'Original' : 'Avant/Après'}</span>
                </button>

                {/* Bouton Rotation 90° */}
                <button
                  type="button"
                  onClick={handleRotate}
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    color: '#1E293B',
                    border: 'none',
                    borderRadius: '8px',
                    width: '30px',
                    height: '30px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                  }}
                  title="Pivoter de 90°"
                >
                  <RotateCw size={14} />
                </button>
              </div>

              {/* BARRE DES PRESETS DE L'ALGORITHME */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>
                  Filtres d'optimisation intelligente
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => applyPreset('auto')}
                    style={{
                      padding: '8px 4px',
                      borderRadius: '10px',
                      border: `1px solid ${preset === 'auto' ? '#0F766E' : '#E2E8F0'}`,
                      backgroundColor: preset === 'auto' ? '#F0FDFA' : 'white',
                      color: preset === 'auto' ? '#0F766E' : '#475569',
                      fontWeight: 700,
                      fontSize: '11px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <span>🪄 Auto</span>
                    <span style={{ fontSize: '9px', fontWeight: 500, opacity: 0.8 }}>Équilibré</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => applyPreset('studio')}
                    style={{
                      padding: '8px 4px',
                      borderRadius: '10px',
                      border: `1px solid ${preset === 'studio' ? '#0F766E' : '#E2E8F0'}`,
                      backgroundColor: preset === 'studio' ? '#F0FDFA' : 'white',
                      color: preset === 'studio' ? '#0F766E' : '#475569',
                      fontWeight: 700,
                      fontSize: '11px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <span>🧼 Studio</span>
                    <span style={{ fontSize: '9px', fontWeight: 500, opacity: 0.8 }}>Fond blanc</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => applyPreset('vibrant')}
                    style={{
                      padding: '8px 4px',
                      borderRadius: '10px',
                      border: `1px solid ${preset === 'vibrant' ? '#0F766E' : '#E2E8F0'}`,
                      backgroundColor: preset === 'vibrant' ? '#F0FDFA' : 'white',
                      color: preset === 'vibrant' ? '#0F766E' : '#475569',
                      fontWeight: 700,
                      fontSize: '11px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <span>🎨 Vives</span>
                    <span style={{ fontSize: '9px', fontWeight: 500, opacity: 0.8 }}>Couvertures</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => applyPreset('sharp')}
                    style={{
                      padding: '8px 4px',
                      borderRadius: '10px',
                      border: `1px solid ${preset === 'sharp' ? '#0F766E' : '#E2E8F0'}`,
                      backgroundColor: preset === 'sharp' ? '#F0FDFA' : 'white',
                      color: preset === 'sharp' ? '#0F766E' : '#475569',
                      fontWeight: 700,
                      fontSize: '11px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <span>🔍 Textes</span>
                    <span style={{ fontSize: '9px', fontWeight: 500, opacity: 0.8 }}>Netteté max</span>
                  </button>
                </div>
              </div>

              {/* LIEN VERS NOUVELLE CAPTURE OU IMPORT */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', fontSize: '12px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={startCamera}
                  style={{ background: 'none', border: 'none', color: '#0F766E', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Camera size={14} />
                  <span>Reprendre une photo</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{ background: 'none', border: 'none', color: '#475569', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Upload size={14} />
                  <span>Changer de fichier</span>
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleFileSelect}
              />
            </div>
          )}
        </div>

        {/* PIED DE PAGE & ACTIONS DE VALIDATION */}
        {mode === 'edit' && (
          <div
            style={{
              padding: '14px 18px',
              borderTop: '1px solid #E2E8F0',
              backgroundColor: '#F8FAFC',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px'
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                backgroundColor: '#E2E8F0',
                color: '#334155',
                border: 'none',
                padding: '10px 16px',
                borderRadius: '10px',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              Annuler
            </button>

            <button
              type="button"
              onClick={handleSaveAndPublish}
              disabled={isProcessing}
              style={{
                flex: 1,
                backgroundColor: '#0F766E',
                color: 'white',
                border: 'none',
                padding: '11px 18px',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '14px',
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 2px 8px rgba(15, 118, 110, 0.3)'
              }}
            >
              <Save size={16} />
              <span>Enregistrer & Publier au Catalogue</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
