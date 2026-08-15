import type { PosProduct } from '../../../context/AppContext';
import { Barcode, Isbn } from '../domain/value-objects/ValueObjects';

export interface ScanResult {
  products: PosProduct[];
  barcode?: string;
  isbn?: string;
  scanned: boolean;
  error?: string;
}

export class BarcodeScannerService {
  private scanBuffer: string[] = [];
  private lastInputTime: number = 0;
  private isScanning: boolean = false;
  private listeners: Array<(barcode: string) => void> = [];
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;
  private scannerDetected: boolean = false;
  private scannerStateListeners: Array<(detected: boolean) => void> = [];

  private static isNumericBarcode(code: string): boolean {
    return /^\d+$/.test(code.replace(/[^0-9]/g, ''));
  }

  private static cleanBarcodeData(raw: string): string {
    let cleaned = raw.trim();

    const azertyMap: Record<string, string> = {
      '&': '1', 'é': '2', '"': '3', "'": '4', '(': '5',
      '-': '6', 'è': '7', '_': '8', 'ç': '9', 'à': '0'
    };

    cleaned = cleaned.split('').map(char => azertyMap[char] || char).join('');

    const numericOnly = cleaned.replace(/[^0-9]/g, '');
    if (numericOnly.length > 0) {
      cleaned = numericOnly;
    } else {
      cleaned = cleaned.replace(/[^\x20-\x7E]/g, '');
    }
    return cleaned;
  }

  startKeyboardListener(): void {
    if (this.keydownListener) return;

    this.keydownListener = (e: KeyboardEvent) => {
      const now = Date.now();
      if (now - this.lastInputTime > 50) {
        this.scanBuffer = [];
        this.isScanning = true;
      }
      this.lastInputTime = now;

      if (e.key === 'Enter' && this.isScanning && this.scanBuffer.length > 0) {
        e.preventDefault();
        const rawBarcode = this.scanBuffer.join('');
        this.scanBuffer = [];
        this.isScanning = false;
        this.scannerDetected = false;
        this.notifyScannerState(false);

        // Remove the raw barcode characters from the focused input if they were typed there
        if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) {
          const input = document.activeElement;
          if (input.value && input.value.endsWith(rawBarcode)) {
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
              Object.getPrototypeOf(input),
              'value'
            )?.set;
            if (nativeInputValueSetter) {
              nativeInputValueSetter.call(input, input.value.slice(0, -rawBarcode.length));
              input.dispatchEvent(new Event('input', { bubbles: true }));
            }
          }
        }

        const cleaned = BarcodeScannerService.cleanBarcodeData(rawBarcode);
        if (cleaned) {
          this.notifyListeners(cleaned);
        }
      } else if (e.key.length === 1 && this.isScanning) {
        if (!e.ctrlKey && !e.altKey && !e.metaKey) {
          this.scanBuffer.push(e.key);
          if (!this.scannerDetected) {
            this.scannerDetected = true;
            this.notifyScannerState(true);
          }
        }
      }
    };

    document.addEventListener('keydown', this.keydownListener);
  }

  stopKeyboardListener(): void {
    if (this.keydownListener) {
      document.removeEventListener('keydown', this.keydownListener);
      this.keydownListener = null;
    }
    this.scannerDetected = false;
    this.notifyScannerState(false);
  }

  isScannerActive(): boolean {
    return this.scannerDetected;
  }

  onScannerStateChange(callback: (detected: boolean) => void): () => void {
    this.scannerStateListeners.push(callback);
    return () => {
      this.scannerStateListeners = this.scannerStateListeners.filter(cb => cb !== callback);
    };
  }

  private notifyScannerState(detected: boolean): void {
    this.scannerStateListeners.forEach(callback => callback(detected));
  }

  subscribe(callback: (barcode: string) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  private notifyListeners(barcode: string): void {
    this.listeners.forEach(callback => callback(barcode));
  }

  searchProduct(scanInput: string, products: PosProduct[]): ScanResult {
    const cleanCode = BarcodeScannerService.cleanBarcodeData(scanInput);
    if (!cleanCode) {
      return { products: [], scanned: false, error: 'Code-barres vide ou invalide' };
    }

    const productByBarcode = products.find(p => p.barcode === cleanCode);
    if (productByBarcode) {
      return {
        products: [productByBarcode],
        barcode: cleanCode,
        scanned: true
      };
    }

    const productByIsbn = products.find(p => p.isbn === cleanCode);
    if (productByIsbn) {
      return {
        products: [productByIsbn],
        isbn: cleanCode,
        scanned: true
      };
    }

    if (cleanCode.length === 10 && Isbn.isValid(cleanCode)) {
      const isbn = new Isbn(cleanCode);
      const product = products.find(p => p.isbn === isbn.toString());
      if (product) {
        return {
          products: [product],
          isbn: cleanCode,
          scanned: true
        };
      }
    }

    const partialMatches = products.filter(p =>
      p.reference.toLowerCase().includes(cleanCode.toLowerCase()) ||
      p.name.toLowerCase().includes(cleanCode.toLowerCase()) ||
      p.barcode?.includes(cleanCode) ||
      p.isbn?.includes(cleanCode)
    );

    return {
      products: partialMatches,
      barcode: partialMatches.length > 0 ? cleanCode : undefined,
      scanned: partialMatches.length > 0
    };
  }

  async lookupBarcodeOnline(barcode: string): Promise<any> {
    try {
      const response = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.warn('Online lookup failed:', error);
    }
    return null;
  }

  validateBarcode(barcode: string): boolean {
    return Barcode.isValid(barcode);
  }

  validateIsbn(isbn: string): boolean {
    return Isbn.isValid(isbn);
  }
}

export const barcodeScannerService = new BarcodeScannerService();
