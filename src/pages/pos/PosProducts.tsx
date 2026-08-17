import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Package, Upload, Camera, FileSpreadsheet, Search, Images, Edit, ArrowLeft } from 'lucide-react';
import { toast } from 'react-hot-toast';
import ProductEntryForm from '../../features/products/presentation/ProductEntryForm';
import ImportExportPanel from '../../features/products/presentation/ImportExportPanel';
import ProductList from '../../features/products/presentation/ProductList';
import BarcodeScannerPanel from '../../features/products/presentation/BarcodeScannerPanel';
import ProductImageGallery from '../../features/products/images/ProductImageGallery';
import ProductImage from '../../features/products/images/ProductImage';
import { useAppContext } from '../../context/AppContext';
import { useProductImages } from '../../features/products/images/ProductImagesContext';

export default function PosProducts() {
  const navigate = useNavigate();
  const { posProducts } = useAppContext();
  const { setProductImage } = useProductImages();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'catalog';
  const setActiveTab = (tab: string) => setSearchParams({ tab });
  const [search, setSearch] = useState('');
  const [initialBarcode, setInitialBarcode] = useState('');
  const [editingProduct, setEditingProduct] = useState<any>(null);

  const tabs = [
    { id: 'catalog', label: 'Catalogue', icon: Package },
    { id: 'new', label: 'Nouveau produit', icon: Package },
    { id: 'import', label: 'Import / Export', icon: Upload },
    { id: 'gallery', label: 'Galerie', icon: Images },
    { id: 'scan', label: 'Scanner', icon: Camera },
    { id: 'complete', label: 'À compléter', icon: FileSpreadsheet },
  ];

  const filteredProducts = posProducts.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.reference.toLowerCase().includes(q) ||
      (p.barcode || '').includes(q) ||
      (p.isbn || '').includes(q)
    );
  });

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => navigate('/pos')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'white', cursor: 'pointer', color: 'var(--color-text)' }} title="Retour">
            <ArrowLeft size={20} />
          </button>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>Produits</h1>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setSearch('');
                if (tab.id !== 'new') {
                  setInitialBarcode('');
                  setEditingProduct(null);
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 16px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                background: activeTab === tab.id ? 'var(--color-surface-alt)' : 'white',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: activeTab === tab.id ? 600 : 400,
                color: activeTab === tab.id ? 'var(--color-text)' : 'var(--color-text-muted)'
              }}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'catalog' && (
        <>
          <div style={{ marginBottom: '16px', position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input
              autoFocus
              style={{ width: '300px', padding: '10px 12px 10px 36px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: '14px', outline: 'none' }}
              placeholder="Rechercher par nom, référence ou code..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.currentTarget.select();
                  if (search.trim() && filteredProducts.length === 0) {
                    toast(
                      (t) => (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <span>Produit introuvable : <b>{search}</b></span>
                          <button 
                            onClick={() => {
                              toast.dismiss(t.id);
                              setInitialBarcode(search);
                              setActiveTab('new');
                            }}
                            style={{ padding: '6px 12px', background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                          >
                            Créer ce produit
                          </button>
                        </div>
                      ),
                      { duration: 5000, icon: '⚠️' }
                    );
                  }
                }
              }}
            />
          </div>

          <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div className="table-responsive">
<table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                  <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Image</th>
                  <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Désignation / Référence</th>
                  <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Code-barres</th>
                  <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>ISBN</th>
                  <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Famille</th>
                  <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'right' }}>Prix Achat</th>
                  <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'right' }}>Prix Vente</th>
                  <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'right' }}>Stock</th>
                  <th style={{ padding: '12px 16px', width: '60px' }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map(product => (
                  <tr key={product.id} style={{ borderBottom: '1px solid var(--color-surface-alt)' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <label style={{ cursor: 'pointer', display: 'block' }} title="Cliquez pour changer l'image">
                        <ProductImage product={product} size={40} />
                        <input 
                          type="file" 
                          accept="image/png,image/jpeg" 
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = async () => {
                                 await setProductImage(product, reader.result as string);
                              };
                              reader.readAsDataURL(file);
                            }
                            e.target.value = '';
                          }}
                        />
                      </label>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 500 }}>{product.name || product.reference}</td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: 'var(--color-text-muted)' }}>{product.barcode || '-'}</td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: 'var(--color-text-muted)' }}>{product.isbn || '-'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      {product.family ? (
                        <span style={{ padding: '2px 8px', borderRadius: 'var(--radius-md)', fontSize: '11px', fontWeight: 500, background: product.family === 'Livre' ? 'var(--color-primary-tint)' : 'var(--color-success-tint)', color: product.family === 'Livre' ? 'var(--color-primary)' : 'var(--color-success)' }}>
                          {product.family}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', textAlign: 'right' }}>{product.purchasePrice.toLocaleString()} FCFA</td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', textAlign: 'right', fontWeight: 600 }}>{product.sellingPrice.toLocaleString()} FCFA</td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', textAlign: 'right' }}>{product.quantity}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button
                        onClick={() => {
                          setEditingProduct(product);
                          setActiveTab('new');
                        }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}
                        title="Modifier"
                      >
                        <Edit size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredProducts.length === 0 && (
                  <tr><td colSpan={9} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>Aucun produit</td></tr>
                )}
              </tbody>
            </table>
</div>
          </div>
        </>
      )}

      {activeTab === 'new' && (
        <ProductEntryForm 
          initialBarcode={initialBarcode} 
          initialProduct={editingProduct} 
          onCancel={() => { setActiveTab('catalog'); setInitialBarcode(''); setEditingProduct(null); }} 
        />
      )}
      {activeTab === 'import' && <ImportExportPanel />}
      {activeTab === 'gallery' && <ProductImageGallery />}
      {activeTab === 'scan' && <BarcodeScannerPanel onNotFound={(barcode) => {
        setInitialBarcode(barcode);
        setActiveTab('new');
      }} />}
      {activeTab === 'complete' && <ProductList />}
    </div>
  );
}
