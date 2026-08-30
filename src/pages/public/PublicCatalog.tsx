import { useState, useMemo, useEffect, useRef } from 'react';
import { Search, ShoppingBag, Plus, Check, X, Smartphone, Home, Layers, Sparkles } from 'lucide-react';
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
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sauvegarder le panier dans localStorage
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
  }, [posProducts, inStockOnly, selectedCategoryId, searchQuery, sortBy]);

  const companyName = posSettings.libraryName || 'Hinov Group';
  const whatsappNumber = (posSettings as any).whatsappOrderPhone || posSettings.phone || '';

  const focusSearch = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 200);
  };

  return (
    <div className="native-catalog-app">
      {/* 1. TOP APP BAR NATIVE */}
      <header className="native-appbar">
        <div className="native-appbar-inner">
          <div className="native-appbar-left">
            <img src="logoh.png" alt="Logo" className="native-appbar-logo" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
            <div className="native-appbar-titles">
              <h1 className="native-appbar-brand">{companyName}</h1>
              <div className="native-appbar-sub">
                <span className="native-live-dot" />
                <span>Catalogue & Boutique</span>
              </div>
            </div>
          </div>

          <div className="native-appbar-right">
            {/* Bouton installation direct */}
            <PwaInstallPrompt variant="icon-button" />

            {/* Bouton Panier avec badge */}
            <button
              className="native-topbar-cart-btn"
              onClick={() => setIsCartOpen(true)}
              title="Voir mon panier"
            >
              <ShoppingBag size={20} />
              {totalCartCount > 0 && (
                <span className="native-badge-count">
                  {totalCartCount > 99 ? '99+' : totalCartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* 2. BANNIÈRE PROMO ULTRA-COMPACTE */}
      <div className="native-promo-strip">
        <Sparkles size={14} style={{ flexShrink: 0 }} />
        <span>{(posSettings as any).catalogBannerText || 'Commandez en direct et faites-vous livrer rapidement via WhatsApp !'}</span>
      </div>

      {/* 3. SECTION COMMANDES (RECHERCHE & CHIPS HORIZONTAUX) */}
      <div className="native-controls-section">
        <div className="native-search-bar">
          <Search className="native-search-icon-left" size={16} />
          <input
            ref={searchInputRef}
            type="text"
            className="native-search-input"
            placeholder="Rechercher un article, titre, référence..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="native-search-clear-btn"
              onClick={() => setSearchQuery('')}
              title="Effacer"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* CAROUSEL DES CATÉGORIES (HORIZONTAL SWIPE) */}
        <div className="native-chips-scroll">
          <button
            className={`native-chip ${selectedCategoryId === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedCategoryId('all')}
          >
            Tous ({posProducts.filter(p => p.isActive !== false).length})
          </button>
          {posCategories.map(cat => {
            const count = posProducts.filter(p => p.isActive !== false && p.categoryId === cat.id).length;
            return (
              <button
                key={cat.id}
                className={`native-chip ${selectedCategoryId === cat.id ? 'active' : ''}`}
                onClick={() => setSelectedCategoryId(cat.id)}
              >
                {cat.name} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. BARRE DE FILTRES SECONDAIRE */}
      <div className="native-filter-bar">
        <label className="native-stock-toggle">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={e => setInStockOnly(e.target.checked)}
          />
          <span>En stock uniquement</span>
        </label>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <select
            className="native-sort-select"
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
          >
            <option value="name">Nom (A-Z)</option>
            <option value="price-asc">Prix croissant</option>
            <option value="price-desc">Prix décroissant</option>
          </select>
        </div>
      </div>

      {/* 5. GRILLE PRODUITS 2 COLONNES TACTILE */}
      <div className="native-catalog-body">
        {filteredProducts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 16px', background: 'white', borderRadius: '16px', border: '1px solid #E2E8F0', marginTop: '10px' }}>
            <div style={{ fontSize: '36px', marginBottom: '8px' }}>🔍</div>
            <h3 style={{ fontSize: '16px', color: '#1E293B', margin: '0 0 4px 0' }}>Aucun produit trouvé</h3>
            <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
              Modifiez votre recherche ou sélectionnez une autre catégorie.
            </p>
          </div>
        ) : (
          <div className="native-product-grid">
            {filteredProducts.map(product => {
              const inCartItem = cart.find(item => item.id === product.id);
              const qtyInCart = inCartItem?.quantity || 0;
              const category = posCategories.find(c => c.id === product.categoryId);
              const isOutOfStock = (product.quantity || 0) <= 0;
              const isLowStock = !isOutOfStock && (product.quantity || 0) <= (product.minStock || 3);

              return (
                <div
                  key={product.id}
                  className="native-product-card"
                  onClick={() => setSelectedProduct(product)}
                >
                  {/* Image carrée 1:1 & Badge Stock */}
                  <div className="native-card-image-box">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} className="native-card-image" loading="lazy" />
                    ) : (
                      <span style={{ fontSize: '36px' }}>📦</span>
                    )}

                    {isOutOfStock ? (
                      <span className="native-stock-tag tag-out-of-stock">Rupture</span>
                    ) : isLowStock ? (
                      <span className="native-stock-tag tag-low-stock">Derniers</span>
                    ) : (
                      <span className="native-stock-tag tag-in-stock">En stock</span>
                    )}
                  </div>

                  {/* Corps de la carte */}
                  <div className="native-card-content">
                    <span className="native-card-category">
                      {category?.name || product.family || 'Article'}
                    </span>
                    <h3 className="native-card-name" title={product.name}>
                      {product.name}
                    </h3>
                    {product.reference && (
                      <span className="native-card-ref">Réf: {product.reference}</span>
                    )}

                    {/* Footer : Prix & Bouton Rapide + */}
                    <div className="native-card-footer">
                      <div className="native-card-price">
                        {formatFCFA(product.sellingPrice)}
                      </div>

                      <button
                        className={`native-quick-add-btn ${qtyInCart > 0 ? 'in-cart' : ''}`}
                        onClick={e => handleAddToCart(product, e)}
                        title="Ajouter au panier"
                        type="button"
                      >
                        {qtyInCart > 0 ? (
                          <Check size={16} />
                        ) : (
                          <Plus size={16} />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 6. MODALE FICHE PRODUIT MOBILE (BOTTOM SHEET NATIVE) */}
      {selectedProduct && (
        <div className="native-sheet-overlay" onClick={e => e.target === e.currentTarget && setSelectedProduct(null)}>
          <div className="native-sheet-modal">
            <div className="native-sheet-handle" />
            <button
              onClick={() => setSelectedProduct(null)}
              style={{
                position: 'absolute',
                top: '12px',
                right: '14px',
                background: '#F1F5F9',
                border: 'none',
                borderRadius: '50%',
                width: '30px',
                height: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 10
              }}
            >
              <X size={16} color="#475569" />
            </button>

            <div className="native-sheet-body">
              <div
                style={{
                  width: '100%',
                  aspectRatio: '1 / 1',
                  maxHeight: '260px',
                  backgroundColor: '#F8FAFC',
                  borderRadius: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  margin: '0 auto 16px auto'
                }}
              >
                {selectedProduct.imageUrl ? (
                  <img src={selectedProduct.imageUrl} alt={selectedProduct.name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '10px' }} />
                ) : (
                  <span style={{ fontSize: '50px' }}>📦</span>
                )}
              </div>

              <span style={{ fontSize: '11px', fontWeight: 800, color: '#0F766E', textTransform: 'uppercase' }}>
                {posCategories.find(c => c.id === selectedProduct.categoryId)?.name || selectedProduct.family || 'Article'}
              </span>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', margin: '4px 0 8px 0', lineHeight: '1.3' }}>
                {selectedProduct.name}
              </h2>

              <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#64748B', marginBottom: '14px', flexWrap: 'wrap' }}>
                {selectedProduct.reference && <span><strong>Réf :</strong> {selectedProduct.reference}</span>}
                {selectedProduct.barcode && <span><strong>Code-barres :</strong> {selectedProduct.barcode}</span>}
                {selectedProduct.isbn && <span><strong>ISBN :</strong> {selectedProduct.isbn}</span>}
              </div>

              {selectedProduct.description && (
                <div style={{ marginBottom: '16px' }}>
                  <h4 style={{ fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>Description</h4>
                  <p style={{ fontSize: '13px', color: '#64748B', lineHeight: '1.5', margin: 0 }}>
                    {selectedProduct.description}
                  </p>
                </div>
              )}
            </div>

            <div className="native-sheet-footer">
              <div>
                <span style={{ fontSize: '11px', color: '#94A3B8', display: 'block' }}>Prix unitaire</span>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#0F766E' }}>
                  {formatFCFA(selectedProduct.sellingPrice)}
                </div>
              </div>

              <button
                className="native-sheet-add-btn"
                onClick={() => {
                  handleAddToCart(selectedProduct);
                  setSelectedProduct(null);
                  setIsCartOpen(true);
                }}
              >
                <Plus size={18} />
                <span>Ajouter au panier</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. TIROIR DU PANIER & VALIDATION WHATSAPP */}
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

      {/* 8. BARRE DE NAVIGATION INFÉRIEURE (BOTTOM BAR NATIVE POUR SMARTPHONE) */}
      <nav className="native-bottom-nav">
        <button
          className="native-bottom-nav-item active"
          onClick={() => {
            setSelectedCategoryId('all');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          <Home size={20} />
          <span>Catalogue</span>
        </button>

        <button
          className="native-bottom-nav-item"
          onClick={focusSearch}
        >
          <Search size={20} />
          <span>Rechercher</span>
        </button>

        <button
          className="native-bottom-nav-item"
          onClick={() => setIsCartOpen(true)}
        >
          <div className="nav-icon-badge-wrap">
            <ShoppingBag size={20} />
            {totalCartCount > 0 && (
              <span className="native-badge-count" style={{ top: '-6px', right: '-8px' }}>
                {totalCartCount}
              </span>
            )}
          </div>
          <span>Panier</span>
        </button>

        {/* Bouton d'installation native directe */}
        <PwaInstallPrompt variant="nav-item" />
      </nav>
    </div>
  );
}
