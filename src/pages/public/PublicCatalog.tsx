import { useState, useMemo, useEffect } from 'react';
import { Search, ShoppingBag, Plus, Check, Filter, ArrowUpDown, Eye, X, Phone, Building2, ExternalLink } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import type { PosProduct } from '../../context/AppContext';
import type { CartItem } from '../../lib/whatsappOrder';
import { formatFCFA } from '../../lib/whatsappOrder';
import { CatalogCartDrawer } from './components/CatalogCartDrawer';
import { PwaInstallPrompt } from './components/PwaInstallPrompt';
import './PublicCatalog.css';

export function PublicCatalog() {
  const { posProducts, posCategories, posBrands, posSettings } = useAppContext();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [selectedBrandId, setSelectedBrandId] = useState<string>('all');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'price-asc' | 'price-desc'>('name');
  
  // Panier avec persistance locale
  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('hinov_public_cart');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return [];
  });

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<PosProduct | null>(null);

  // Sauvegarder le panier dans localStorage à chaque modification
  useEffect(() => {
    localStorage.setItem('hinov_public_cart', JSON.stringify(cart));
  }, [cart]);

  // Ajouter au panier
  const handleAddToCart = (product: PosProduct, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...prev,
        {
          id: product.id,
          reference: product.reference,
          name: product.name,
          sellingPrice: product.sellingPrice,
          quantity: 1,
          imageUrl: product.imageUrl,
          family: product.family,
          unit: product.unit
        }
      ];
    });
  };

  // Modifier la quantité
  const handleUpdateQuantity = (id: string, delta: number) => {
    setCart(prev =>
      prev
        .map(item => {
          if (item.id === id) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  // Supprimer un article
  const handleRemoveItem = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  // Vider le panier
  const handleClearCart = () => {
    setCart([]);
  };

  // Nombre total d'articles dans le panier
  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Filtrage et tri des produits
  const filteredProducts = useMemo(() => {
    return posProducts
      .filter(p => {
        // Filtrer les inactifs
        if (p.isActive === false || p.status === 'Inactive') return false;

        // Filtre de stock
        if (inStockOnly && (p.quantity || 0) <= 0) return false;

        // Filtre de catégorie
        if (selectedCategoryId !== 'all' && p.categoryId !== selectedCategoryId) return false;

        // Filtre de marque
        if (selectedBrandId !== 'all' && p.brandId !== selectedBrandId) return false;

        // Recherche par texte
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchName = p.name?.toLowerCase().includes(q);
          const matchRef = p.reference?.toLowerCase().includes(q);
          const matchBarcode = p.barcode?.includes(q);
          const matchIsbn = p.isbn?.includes(q);
          const matchDesc = p.description?.toLowerCase().includes(q);
          if (!matchName && !matchRef && !matchBarcode && !matchIsbn && !matchDesc) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'price-asc') return a.sellingPrice - b.sellingPrice;
        if (sortBy === 'price-desc') return b.sellingPrice - a.sellingPrice;
        return a.name.localeCompare(b.name);
      });
  }, [posProducts, inStockOnly, selectedCategoryId, selectedBrandId, searchQuery, sortBy]);

  const companyName = posSettings.libraryName || 'Hinov Group';
  const whatsappNumber = (posSettings as any).whatsappOrderPhone || posSettings.phone || '';

  return (
    <div className="catalog-container">
      {/* BANNIÈRE D'INSTALLATION PWA */}
      <PwaInstallPrompt variant="banner" />

      {/* HEADER */}
      <header className="catalog-header">
        <div className="catalog-header-inner">
          <div className="catalog-brand">
            <img src="logoh.png" alt="Logo Hinov" className="catalog-logo" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
            <div className="catalog-brand-text">
              <h1>{companyName}</h1>
              <p>Catalogue & Boutique en ligne</p>
            </div>
          </div>

          <div className="catalog-header-actions">
            {/* Bouton installer PWA */}
            <PwaInstallPrompt variant="button" />

            {/* Bouton Panier */}
            <button
              onClick={() => setIsCartOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: '#F0FDFA',
                color: '#0F766E',
                border: '1px solid #CCFBF1',
                padding: '8px 16px',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              <ShoppingBag size={18} />
              <span>Panier</span>
              {totalCartCount > 0 && (
                <span className="catalog-cart-badge" style={{ width: '20px', height: '20px', fontSize: '11px' }}>
                  {totalCartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="catalog-hero">
        <div className="catalog-hero-content">
          <h2>Découvrez notre catalogue & commandez via WhatsApp</h2>
          <p>
            {(posSettings as any).catalogBannerText || 'Sélectionnez vos articles, ajoutez-les à votre panier et transmettez votre commande instantanément par WhatsApp.'}
          </p>

          <div className="catalog-search-wrapper">
            <Search className="catalog-search-icon" size={18} />
            <input
              type="text"
              className="catalog-search-input"
              placeholder="Rechercher un livre, fourniture, référence..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94A3B8',
                  cursor: 'pointer'
                }}
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* CONTENU PRINCIPAL */}
      <main className="catalog-main">
        {/* CATÉGORIES */}
        <div className="catalog-categories">
          <button
            className={`catalog-category-btn ${selectedCategoryId === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedCategoryId('all')}
          >
            Tous les articles ({posProducts.filter(p => p.isActive !== false).length})
          </button>
          {posCategories.map(cat => {
            const count = posProducts.filter(p => p.isActive !== false && p.categoryId === cat.id).length;
            return (
              <button
                key={cat.id}
                className={`catalog-category-btn ${selectedCategoryId === cat.id ? 'active' : ''}`}
                onClick={() => setSelectedCategoryId(cat.id)}
              >
                {cat.name} ({count})
              </button>
            );
          })}
        </div>

        {/* TOOLBAR FILTRES ET TRI */}
        <div className="catalog-toolbar">
          <div className="catalog-filter-tags">
            <label className="catalog-checkbox-label">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={e => setInStockOnly(e.target.checked)}
              />
              <span>En stock uniquement</span>
            </label>

            {posBrands.length > 0 && (
              <select
                value={selectedBrandId}
                onChange={e => setSelectedBrandId(e.target.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  background: 'white',
                  fontSize: '13px',
                  color: '#475569',
                  outline: 'none'
                }}
              >
                <option value="all">Toutes les marques</option>
                {posBrands.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: '#64748B' }}>
              <strong>{filteredProducts.length}</strong> produit{filteredProducts.length > 1 ? 's' : ''}
            </span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid #E2E8F0',
                background: 'white',
                fontSize: '13px',
                color: '#475569',
                outline: 'none'
              }}
            >
              <option value="name">Trier par nom (A-Z)</option>
              <option value="price-asc">Prix croissant</option>
              <option value="price-desc">Prix décroissant</option>
            </select>
          </div>
        </div>

        {/* GRILLE DE PRODUITS */}
        {filteredProducts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', background: 'white', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '42px', marginBottom: '12px' }}>🔍</div>
            <h3 style={{ fontSize: '18px', color: '#1E293B', margin: '0 0 6px 0' }}>Aucun produit ne correspond à votre recherche</h3>
            <p style={{ fontSize: '14px', color: '#64748B', margin: 0 }}>
              Essayez de modifier vos filtres ou termes de recherche.
            </p>
          </div>
        ) : (
          <div className="catalog-grid">
            {filteredProducts.map(product => {
              const inCartItem = cart.find(item => item.id === product.id);
              const qtyInCart = inCartItem?.quantity || 0;
              const category = posCategories.find(c => c.id === product.categoryId);
              const isOutOfStock = (product.quantity || 0) <= 0;
              const isLowStock = !isOutOfStock && (product.quantity || 0) <= (product.minStock || 3);

              return (
                <div
                  key={product.id}
                  className="catalog-card"
                  onClick={() => setSelectedProduct(product)}
                >
                  {/* Image & Badges */}
                  <div className="catalog-card-image-wrap">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} className="catalog-card-image" loading="lazy" />
                    ) : (
                      <div style={{ color: '#94A3B8', fontSize: '38px' }}>📦</div>
                    )}

                    {isOutOfStock ? (
                      <span className="catalog-card-badge badge-out-of-stock">Rupture</span>
                    ) : isLowStock ? (
                      <span className="catalog-card-badge badge-low-stock">Dernières pièces</span>
                    ) : (
                      <span className="catalog-card-badge badge-in-stock">En stock</span>
                    )}
                  </div>

                  {/* Body */}
                  <div className="catalog-card-body">
                    <span className="catalog-card-category">{category?.name || product.family || 'Article'}</span>
                    <h3 className="catalog-card-title" title={product.name}>
                      {product.name}
                    </h3>
                    {product.reference && (
                      <span className="catalog-card-ref">Réf: {product.reference}</span>
                    )}

                    {/* Footer / Prix & Bouton */}
                    <div className="catalog-card-footer">
                      <div className="catalog-card-price">
                        {formatFCFA(product.sellingPrice)}
                      </div>

                      <button
                        className={`catalog-add-btn ${qtyInCart > 0 ? 'in-cart' : ''}`}
                        onClick={e => handleAddToCart(product, e)}
                        title="Ajouter au panier"
                      >
                        {qtyInCart > 0 ? (
                          <>
                            <Check size={14} />
                            <span>{qtyInCart}</span>
                          </>
                        ) : (
                          <>
                            <Plus size={14} />
                            <span>Ajouter</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* BOUTON FLOTTANT PANIER MOBILE / SCROLL */}
      {totalCartCount > 0 && (
        <button
          className="catalog-floating-cart"
          onClick={() => setIsCartOpen(true)}
        >
          <ShoppingBag size={20} />
          <span>Voir mon panier</span>
          <span className="catalog-cart-badge">{totalCartCount}</span>
        </button>
      )}

      {/* MODAL VUE DÉTAILLÉE PRODUIT */}
      {selectedProduct && (
        <div className="catalog-modal-overlay" onClick={e => e.target === e.currentTarget && setSelectedProduct(null)}>
          <div className="catalog-modal">
            <button
              onClick={() => setSelectedProduct(null)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: '#F1F5F9',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 10
              }}
            >
              <X size={18} color="#475569" />
            </button>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px', padding: '24px' }}>
              <div
                style={{
                  width: '100%',
                  aspectRatio: '16 / 10',
                  backgroundColor: '#F8FAFC',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden'
                }}
              >
                {selectedProduct.imageUrl ? (
                  <img src={selectedProduct.imageUrl} alt={selectedProduct.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <span style={{ fontSize: '56px' }}>📦</span>
                )}
              </div>

              <div>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#0F766E', textTransform: 'uppercase' }}>
                  {posCategories.find(c => c.id === selectedProduct.categoryId)?.name || selectedProduct.family || 'Article'}
                </span>
                <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#1E293B', margin: '4px 0 12px 0' }}>
                  {selectedProduct.name}
                </h2>

                <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: '#64748B', marginBottom: '16px', flexWrap: 'wrap' }}>
                  {selectedProduct.reference && <span><strong>Réf :</strong> {selectedProduct.reference}</span>}
                  {selectedProduct.barcode && <span><strong>Code-barres :</strong> {selectedProduct.barcode}</span>}
                  {selectedProduct.isbn && <span><strong>ISBN :</strong> {selectedProduct.isbn}</span>}
                </div>

                {selectedProduct.description && (
                  <div style={{ marginBottom: '20px' }}>
                    <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Description</h4>
                    <p style={{ fontSize: '14px', color: '#64748B', lineHeight: '1.6', margin: 0 }}>
                      {selectedProduct.description}
                    </p>
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #E2E8F0' }}>
                  <div>
                    <span style={{ fontSize: '12px', color: '#94A3B8' }}>Prix unitaire</span>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: '#0F766E' }}>
                      {formatFCFA(selectedProduct.sellingPrice)}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      handleAddToCart(selectedProduct);
                      setSelectedProduct(null);
                      setIsCartOpen(true);
                    }}
                    style={{
                      backgroundColor: '#0F766E',
                      color: 'white',
                      border: 'none',
                      padding: '12px 24px',
                      borderRadius: '12px',
                      fontWeight: 700,
                      fontSize: '14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <Plus size={18} />
                    <span>Ajouter au panier</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TIROIR PANIER */}
      <CatalogCartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cart}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onClearCart={handleClearCart}
        whatsappPhone={whatsappNumber}
        companyName={companyName}
      />

      {/* FOOTER */}
      <footer className="catalog-footer">
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <p style={{ margin: '0 0 10px 0', fontWeight: 600 }}>
            {companyName} — {posSettings.address || 'Abidjan, Côte d\'Ivoire'}
          </p>
          {posSettings.phone && (
            <p style={{ margin: '0 0 16px 0' }}>
              Service client : <a href={`tel:${posSettings.phone}`}>{posSettings.phone}</a>
            </p>
          )}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', fontSize: '12px' }}>
            <a href="/#/login">Espace Collaborateur (Connexion)</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
