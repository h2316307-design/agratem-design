import { PriceList, BillboardSize, QuoteItem, Quote, CustomerType, PackageDuration, PriceListType, SizeManagement, DurationPricing } from '@/types'
import { formatGregorianDate } from '@/lib/dateUtils'

// ا��مقاسات الافتراضية
const DEFAULT_SIZES: BillboardSize[] = ['5x13', '4x12', '4x10', '3x8', '3x6', '3x4']

// الباقات الزمنية المتاحة
const DEFAULT_PACKAGES: PackageDuration[] = [
  { value: 1, unit: 'month', label: 'شهر واحد', discount: 0 },
  { value: 3, unit: 'months', label: '3 أشهر', discount: 5 },
  { value: 6, unit: 'months', label: '6 أشهر', discount: 10 },
  { value: 12, unit: 'year', label: 'سنة كاملة', discount: 20 }
]

// إنشاء أسعار افتراضية لمدة معينة
const createDefaultPricesForDuration = (duration: number): Record<BillboardSize, number> => {
  const basePrices: Record<BillboardSize, number> = {
    '5x13': 3500,
    '4x12': 2800,
    '4x10': 2200,
    '3x8': 1500,
    '3x6': 1000,
    '3x4': 800
  }

  // تطبيق خصم حسب المدة
  const discount = duration === 1 ? 0 : duration === 3 ? 0.05 : duration === 6 ? 0.1 : duration === 12 ? 0.2 : 0
  
  const result: Record<BillboardSize, number> = {}
  Object.entries(basePrices).forEach(([size, price]) => {
    result[size] = Math.round(price * (1 - discount))
  })
  
  return result
}

// إنشاء أسعار A/B افتراضية مع المدد
const createDefaultABPricing = (): DurationPricing => ({
  '1': createDefaultPricesForDuration(1),
  '3': createDefaultPricesForDuration(3),
  '6': createDefaultPricesForDuration(6),
  '12': createDefaultPricesForDuration(12)
})

// قائمة الأسعار الافتراضية الجديدة
const DEFAULT_PRICING_NEW: PriceList = {
  zones: {
    'مصراتة': {
      name: 'مصراتة',
      prices: {
        marketers: createDefaultPricesForDuration(1),
        individuals: createDefaultPricesForDuration(1),
        companies: createDefaultPricesForDuration(1)
      },
      abPrices: {
        A: createDefaultABPricing(),
        B: {
          '1': createDefaultPricesForDuration(1),
          '3': createDefaultPricesForDuration(3),
          '6': createDefaultPricesForDuration(6),
          '12': createDefaultPricesForDuration(12)
        }
      }
    },
    'أبو سليم': {
      name: 'أبو سليم',
      prices: {
        marketers: createDefaultPricesForDuration(1),
        individuals: createDefaultPricesForDuration(1),
        companies: createDefaultPricesForDuration(1)
      },
      abPrices: {
        A: createDefaultABPricing(),
        B: createDefaultABPricing()
      }
    }
  },
  packages: DEFAULT_PACKAGES,
  currency: 'د.ل'
}

/**
 * خدمة إدارة الأسعار المحدثة
 * تدعم المدد المختلفة والم��اسات الديناميكية
 */
class NewPricingService implements SizeManagement {
  private readonly PRICING_STORAGE_KEY = 'al-fares-pricing-v2'
  private readonly SIZES_STORAGE_KEY = 'al-fares-sizes'
  public sizes: BillboardSize[] = []

  constructor() {
    this.initializeDefaults()
    this.loadSizes()
  }

  /**
   * تهيئة البيانات الافتراضية
   */
  private initializeDefaults() {
    if (!localStorage.getItem(this.PRICING_STORAGE_KEY)) {
      localStorage.setItem(this.PRICING_STORAGE_KEY, JSON.stringify(DEFAULT_PRICING_NEW))
    }
    if (!localStorage.getItem(this.SIZES_STORAGE_KEY)) {
      localStorage.setItem(this.SIZES_STORAGE_KEY, JSON.stringify(DEFAULT_SIZES))
    }
  }

  /**
   * تحميل المقاسات من التخزين
   */
  private loadSizes() {
    try {
      const sizes = localStorage.getItem(this.SIZES_STORAGE_KEY)
      this.sizes = sizes ? JSON.parse(sizes) : DEFAULT_SIZES
    } catch {
      this.sizes = DEFAULT_SIZES
    }
  }

  /**
   * حفظ المقاسات في التخزين
   */
  private saveSizes() {
    localStorage.setItem(this.SIZES_STORAGE_KEY, JSON.stringify(this.sizes))
  }

  /**
   * إضا��ة مقاس جديد
   */
  addSize(size: BillboardSize): boolean {
    if (!this.validateSize(size) || this.sizes.includes(size)) {
      return false
    }
    this.sizes.push(size)
    this.saveSizes()
    return true
  }

  /**
   * ح��ف مقاس
   */
  removeSize(size: BillboardSize): boolean {
    const index = this.sizes.indexOf(size)
    if (index === -1 || this.sizes.length <= 1) {
      return false
    }
    this.sizes.splice(index, 1)
    this.saveSizes()
    return true
  }

  /**
   * التحقق من صحة المقاس
   */
  validateSize(size: string): boolean {
    // ت��قق من أن المقاس بصيغة مثل "5x13" أو "4x12"
    const sizePattern = /^\d+x\d+$/
    return sizePattern.test(size) && size.length <= 10
  }

  /**
   * الحصول على قائمة الأسعار
   */
  getPricing(): PriceList {
    try {
      const pricing = localStorage.getItem(this.PRICING_STORAGE_KEY)
      return pricing ? JSON.parse(pricing) : DEFAULT_PRICING_NEW
    } catch {
      return DEFAULT_PRICING_NEW
    }
  }

  /**
   * تحديث قائمة الأسعار
   */
  updatePricing(pricing: PriceList): { success: boolean; error?: string } {
    try {
      localStorage.setItem(this.PRICING_STORAGE_KEY, JSON.stringify(pricing))
      return { success: true }
    } catch (error) {
      console.error('خطأ في تحديث الأسعار:', error)
      return { success: false, error: 'حدث خطأ في حفظ الأسعار' }
    }
  }

  /**
   * الحصول على سعر لو��ة حسب القائمة والمدة
   */
  getBillboardPriceABWithDuration(
    size: BillboardSize,
    zone: string,
    priceList: PriceListType = 'A',
    duration: number = 1,
    municipality?: string
  ): number {
    const pricing = this.getPricing()
    const zoneData = pricing.zones[zone]

    if (!zoneData || !zoneData.abPrices || !zoneData.abPrices[priceList]) {
      return 0
    }

    const durationKey = duration.toString() as keyof DurationPricing
    const durationPrices = zoneData.abPrices[priceList][durationKey]

    if (!durationPrices || !durationPrices[size]) {
      return 0
    }

    const basePrice = durationPrices[size]

    // تطبيق معامل البلدية إذا تم توفيره (افتراضي: 1)
    if (municipality) {
      const multiplier = this.getMunicipalityMultiplier(municipality)
      return Math.round(basePrice * multiplier)
    }

    return basePrice
  }

  /**
   * الحصول على سعر لوحة حسب فئة الزبون (للنظام القديم)
   */
  getBillboardPrice(size: BillboardSize, zone: string, customerType: CustomerType = 'individuals', municipality?: string): number {
    const pricing = this.getPricing()
    const zoneData = pricing.zones[zone]

    if (!zoneData || !zoneData.prices[customerType] || !zoneData.prices[customerType][size]) {
      return 0
    }

    const basePrice = zoneData.prices[customerType][size]

    // تطبيق معامل البلدية إذا تم توفيره (افتراضي: 1)
    if (municipality) {
      const multiplier = this.getMunicipalityMultiplier(municipality)
      return Math.round(basePrice * multiplier)
    }

    return basePrice
  }

  /**
   * تحديد قائمة الأسعار من بيانات اللوحة
   */
  determinePriceListFromBillboard(billboard: any): PriceListType {
    // إذا كان للوحة تصنيف سعر محدد
    if (billboard.priceCategory && (billboard.priceCategory === 'A' || billboard.priceCategory === 'B')) {
      return billboard.priceCategory
    }

    // إذا كان المستوى يحدد القائمة
    if (billboard.level) {
      const level = billboard.level.toLowerCase()
      if (level.includes('مسوق') || level.includes('a') || level === '1') {
        return 'A'
      }
      if (level.includes('شرك') || level.includes('b') || level === '2') {
        return 'B'
      }
    }

    // القيمة الافتراضية
    return 'A'
  }

  /**
   * الحصول على الباقات الزمنية المتاحة
   */
  getPackages(): PackageDuration[] {
    const pricing = this.getPricing()
    return pricing.packages || DEFAULT_PACKAGES
  }

  /**
   * حساب السعر مع الخصم حسب الباقة
   */
  calculatePriceWithDiscount(basePrice: number, packageDuration: PackageDuration): {
    finalPrice: number
    discount: number
    totalDiscount: number
  } {
    const discountAmount = (basePrice * packageDuration.discount) / 100
    const finalPrice = basePrice - discountAmount

    return {
      finalPrice,
      discount: packageDuration.discount,
      totalDiscount: discountAmount * packageDuration.value
    }
  }

  /**
   * إنشاء فاتورة عرض محدثة
   */
  generateQuote(
    customerInfo: {
      name: string
      email: string
      phone: string
      company?: string
      type: CustomerType
    },
    billboards: Array<{
      id: string
      name: string
      location: string
      municipality: string
      area: string
      size: BillboardSize
      status: string
      imageUrl?: string
      level?: string
      priceCategory?: PriceListType
    }>,
    packageDuration: PackageDuration
  ): Quote {
    const pricing = this.getPricing()

    const items: QuoteItem[] = billboards.map(billboard => {
      const zone = this.determinePricingZone(billboard.municipality, billboard.area)
      const priceList = this.determinePriceListFromBillboard(billboard)
      // Get the duration-adjusted price (already includes duration discount) with municipality multiplier
      const finalPrice = this.getBillboardPriceABWithDuration(
        billboard.size,
        zone,
        priceList,
        packageDuration.value,
        billboard.municipality
      )

      // Calculate what the base price would have been without duration discount
      const basePrice = packageDuration.discount > 0
        ? Math.round(finalPrice / (1 - packageDuration.discount / 100))
        : finalPrice

      return {
        billboardId: billboard.id,
        name: billboard.name,
        location: billboard.location,
        size: billboard.size,
        zone,
        basePrice,
        finalPrice,
        duration: packageDuration.value,
        discount: packageDuration.discount,
        total: finalPrice * packageDuration.value,
        imageUrl: billboard.imageUrl
      }
    })

    const subtotal = items.reduce((sum, item) => sum + (item.basePrice * item.duration), 0)
    const totalDiscount = items.reduce((sum, item) => sum + ((item.basePrice - item.finalPrice) * item.duration), 0)
    const taxRate = 0.0
    const tax = (subtotal - totalDiscount) * taxRate
    const total = subtotal - totalDiscount + tax

    return {
      id: `Q-${Date.now()}`,
      customerInfo,
      packageInfo: {
        duration: packageDuration.value,
        label: packageDuration.label,
        discount: packageDuration.discount
      },
      items,
      subtotal,
      totalDiscount,
      tax,
      taxRate,
      total,
      currency: pricing.currency,
      createdAt: new Date().toISOString(),
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    }
  }

  /**
   * تحديد المنطقة السعرية بناءً على البلدية مباشرة
   * المنطقة السعرية هي نفس اسم البلدية
   */
  determinePricingZone(municipality: string, area?: string): string {
    // استخدام اسم البلدية مباشرة كمنطقة سعرية
    const zoneName = municipality.trim()

    // التأكد من وجود أسعار لهذه المنطقة
    const pricing = this.getPricing()
    if (pricing.zones[zoneName]) {
      return zoneName
    }

    // إذا لم توجد أسعار لهذه البلدية، البحث عن أقرب تطابق
    const availableZones = Object.keys(pricing.zones)
    const municipalityLower = municipality.toLowerCase().trim()

    for (const zone of availableZones) {
      if (zone.toLowerCase().includes(municipalityLower) || municipalityLower.includes(zone.toLowerCase())) {
        return zone
      }
    }

    // إعادة المنطقة الافتراضية إذا لم يوجد تطابق
    return availableZones[0] || 'مصراتة'
  }

  /**
   * إضافة منطقة سعرية جديدة بناءً على البلدية
   */
  addPricingZoneForMunicipality(municipality: string, baseZone: string = 'مصراتة'): boolean {
    const pricing = this.getPricing()
    const zoneName = municipality.trim()

    // إذا كانت المنطقة موجودة، لا تفعل شيء
    if (pricing.zones[zoneName]) {
      return true
    }

    // استخدام خدمة إدارة المناطق التلقائية إذا كانت متاحة
    try {
      const { pricingZoneAutoManager } = require('./pricingZoneAutoManager')
      const newZone = pricingZoneAutoManager.createDefaultPricingZone(zoneName, baseZone)
      pricing.zones[zoneName] = newZone
    } catch (error) {
      // الطريقة القديمة كـ fallback
      const baseZoneData = pricing.zones[baseZone]
      if (!baseZoneData) {
        return false
      }

      pricing.zones[zoneName] = {
        ...baseZoneData,
        name: zoneName
      }
    }

    return this.updatePricing(pricing).success
  }

  /**
   * مزامنة المناطق السعرية مع ملف الإك��ل تلقائياً
   */
  async syncWithExcelData(): Promise<{ success: boolean; summary?: any; error?: string }> {
    try {
      // استيراد خدمة إدارة المناطق التلقائية
      const { pricingZoneAutoManager } = await import('./pricingZoneAutoManager')

      // تنفيذ المزامنة
      const result = await pricingZoneAutoManager.syncPricingZonesWithExcel()

      if (result.success) {
        console.log('[NewPricingService] تمت مزامنة المناطق السعرية بنجاح')
        return {
          success: true,
          summary: {
            totalMunicipalities: result.totalMunicipalities,
            existingZones: result.existingZones.length,
            newZonesCreated: result.newZonesCreated.length,
            newZones: result.newZonesCreated
          }
        }
      } else {
        return { success: false, error: result.errors.join(', ') }
      }
    } catch (error: any) {
      console.error('[NewPricingService] خطأ في مزامنة المناطق:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * التحقق من الحاجة لمزامنة المناطق السعرية
   */
  async checkNeedForSync(): Promise<{ needsSync: boolean; missingZones: string[] }> {
    try {
      const { pricingZoneAutoManager } = await import('./pricingZoneAutoManager')
      const analysis = await pricingZoneAutoManager.analyzePricingZones()

      return {
        needsSync: analysis.missingZones.length > 0,
        missingZones: analysis.missingZones
      }
    } catch (error) {
      console.error('[NewPricingService] خطأ في فحص الحاجة للمزامنة:', error)
      return { needsSync: false, missingZones: [] }
    }
  }

  /**
   * الحصول على معامل البلدية مع الافتراضي 1
   */
  getMunicipalityMultiplier(municipality: string): number {
    // محاولة الحصول على معامل البلدية من خدمة البلديات
    try {
      // تجربة استيراد خدمة البلديات بشكل ديناميكي
      if (typeof window !== 'undefined' && (window as any).municipalityService) {
        const municipalityData = (window as any).municipalityService.getMunicipalityByName(municipality)
        if (municipalityData && typeof municipalityData.multiplier === 'number') {
          return municipalityData.multiplier
        }
      }
    } catch (error) {
      console.warn('خطأ في الحصول على معامل البلدية:', error)
    }

    // الافتراضي هو 1 إذا لم يجد المعام��
    return 1.0
  }

  /**
   * الحصول على قائمة المناطق السعرية
   */
  getPricingZones(): string[] {
    const pricing = this.getPricing()
    return Object.keys(pricing.zones)
  }

  /**
   * الحصول على قائمة فئات الزبائن المتاحة
   */
  getCustomerTypes(): Array<{value: CustomerType, label: string}> {
    return [
      { value: 'marketers', label: 'المسوقين' },
      { value: 'individuals', label: 'العاديين' },
      { value: 'companies', label: 'الشركات' }
    ]
  }

  /**
   * الحصول على قوائم الأسعار ��لمتاحة (A و B)
   */
  getPriceListTypes(): Array<{value: PriceListType, label: string}> {
    return [
      { value: 'A', label: 'مستوى 1 - سيتي A' },
      { value: 'B', label: 'مستوى 2 - مسوقين' }
    ]
  }

  /**
   * إضافة مقاس جديد لجميع المناطق والقوائم
   */
  addSizeToAllZones(size: BillboardSize, defaultPrice: number = 1000): boolean {
    if (!this.addSize(size)) {
      return false
    }

    const pricing = this.getPricing()
    const updatedPricing = { ...pricing }

    // إضافة المقاس لجميع المناطق
    Object.keys(updatedPricing.zones).forEach(zoneName => {
      const zone = updatedPricing.zones[zoneName]
      
      // إضافة للأسعار العادية
      if (zone.prices) {
        Object.keys(zone.prices).forEach(customerType => {
          zone.prices[customerType as CustomerType][size] = defaultPrice
        })
      }

      // إضافة لقوائم A/B
      if (zone.abPrices) {
        Object.keys(zone.abPrices).forEach(priceList => {
          const list = zone.abPrices[priceList as PriceListType]
          Object.keys(list).forEach(duration => {
            list[duration as keyof DurationPricing][size] = defaultPrice
          })
        })
      }
    })

    return this.updatePricing(updatedPricing).success
  }

  /**
   * حذف مقاس من جميع المناطق والقوائم
   */
  removeSizeFromAllZones(size: BillboardSize): boolean {
    if (!this.removeSize(size)) {
      return false
    }

    const pricing = this.getPricing()
    const updatedPricing = { ...pricing }

    // حذف المقاس من ج��يع المناطق
    Object.keys(updatedPricing.zones).forEach(zoneName => {
      const zone = updatedPricing.zones[zoneName]
      
      // حذف من الأسعار العادية
      if (zone.prices) {
        Object.keys(zone.prices).forEach(customerType => {
          delete zone.prices[customerType as CustomerType][size]
        })
      }

      // حذف من قوائم A/B
      if (zone.abPrices) {
        Object.keys(zone.abPrices).forEach(priceList => {
          const list = zone.abPrices[priceList as PriceListType]
          Object.keys(list).forEach(duration => {
            delete list[duration as keyof DurationPricing][size]
          })
        })
      }
    })

    return this.updatePricing(updatedPricing).success
  }

  /**
   * طباعة فاتورة العرض
   */
  printQuote(quote: Quote): void {
    const printContent = this.exportQuoteToPDF(quote)
    const printWindow = window.open('', '_blank')

    if (!printWindow) {
      alert('يرجى السماح بفتح النوافذ المنبثقة لطباعة الفاتورة')
      return
    }

    printWindow.document.write(printContent)
    printWindow.document.close()
  }

  /**
   * تصدير فاتورة العرض لـ PDF - نسخة محدثة
   */
  exportQuoteToPDF(quote: Quote): string {
    const printContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>عرض سعر - الفارس الذهبي</title>
        <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
        <style>
          @page { size: A4; margin: 15mm; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Tajawal', 'Cairo', 'Arial', sans-serif;
            direction: rtl;
            background: white;
            color: #000;
            line-height: 1.6;
            font-size: 12px;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding: 15px 0;
            border-bottom: 3px solid #D4AF37;
          }
          .logo-section {
            display: flex;
            align-items: center;
            gap: 15px;
          }
          .logo { width: 80px; height: 80px; object-fit: contain; }
          .company-info { text-align: right; }
          .company-name-ar {
            font-size: 20px;
            font-weight: 700;
            color: #000;
            margin-bottom: 3px;
          }
          .company-name-en {
            font-size: 14px;
            color: #666;
            font-weight: 400;
          }
          .quote-header {
            text-align: center;
            margin-bottom: 30px;
          }
          .quote-title {
            font-size: 24px;
            font-weight: 700;
            color: #000;
            background: linear-gradient(135deg, #D4AF37, #F4E04D);
            padding: 10px 30px;
            border-radius: 25px;
            display: inline-block;
            margin-bottom: 10px;
          }
          .customer-section {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-bottom: 25px;
          }
          .info-group h3 {
            color: #D4AF37;
            font-size: 16px;
            font-weight: 700;
            margin-bottom: 10px;
            border-bottom: 2px solid #D4AF37;
            padding-bottom: 5px;
          }
          .info-item {
            margin-bottom: 8px;
            font-size: 13px;
          }
          .info-label {
            font-weight: 700;
            color: #333;
            margin-left: 10px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 25px;
            font-size: 11px;
          }
          th, td {
            border: 1px solid #D4AF37;
            padding: 8px 6px;
            text-align: center;
            vertical-align: middle;
          }
          th {
            background: linear-gradient(135deg, #D4AF37, #F4E04D);
            color: #000;
            font-weight: 700;
            font-size: 12px;
          }
          tr:nth-child(even) { background: #FFFEF7; }
          .price { font-weight: 700; color: #D4AF37; }
          .totals-section {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 10px;
            border: 2px solid #D4AF37;
            margin-bottom: 25px;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            font-size: 14px;
          }
          .total-row.final {
            font-size: 18px;
            font-weight: 700;
            color: #D4AF37;
            border-top: 2px solid #D4AF37;
            padding-top: 15px;
            margin-top: 15px;
          }
          .terms {
            background: #f0f9ff;
            padding: 15px;
            border-radius: 8px;
            border-right: 4px solid #3b82f6;
            margin-top: 25px;
          }
          .terms h3 {
            color: #1e40af;
            margin-bottom: 10px;
            font-size: 14px;
          }
          .terms ul { list-style: none; padding-right: 20px; }
          .terms li {
            margin-bottom: 5px;
            font-size: 11px;
            position: relative;
          }
          .terms li:before {
            content: "•";
            color: #3b82f6;
            font-weight: bold;
            position: absolute;
            right: -15px;
          }
          .footer {
            margin-top: 30px;
            text-align: center;
            color: #666;
            font-size: 11px;
            border-top: 1px solid #ddd;
            padding-top: 15px;
          }
          @media print {
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo-section">
            <img src="${window.location.origin}/logo-symbol.svg" alt="شعار الشركة" class="logo" />
            <div class="company-info">
              <div class="company-name-ar">الفــــارس ��لذهبــــي</div>
              <div class="company-name-en">AL FARES AL DAHABI</div>
              <div class="company-name-ar" style="font-size: 12px;">للدعــــــاية والإعـــلان</div>
            </div>
          </div>
        </div>

        <div class="quote-header">
          <div class="quote-title">عرض سعر إعلاني محدث</div>
          <div style="color: #666; font-size: 14px;">رقم العرض: ${quote.id}</div>
          <div style="color: #666; font-size: 12px;">تاريخ العرض: ${formatGregorianDate(quote.createdAt)}</div>
          <div style="color: #666; font-size: 12px;">صالح حتى: ${formatGregorianDate(quote.validUntil)}</div>
        </div>

        <div class="customer-section">
          <div class="info-group">
            <h3>بيانات العميل</h3>
            <div class="info-item">
              <span class="info-label">الاسم:</span>
              ${quote.customerInfo.name}
            </div>
            <div class="info-item">
              <span class="info-label">البريد الإلكتروني:</span>
              ${quote.customerInfo.email}
            </div>
            <div class="info-item">
              <span class="info-label">رقم الهاتف:</span>
              ${quote.customerInfo.phone}
            </div>
            ${quote.customerInfo.company ? `
            <div class="info-item">
              <span class="info-label">الشركة:</span>
              ${quote.customerInfo.company}
            </div>
            ` : ''}
          </div>
          <div class="info-group">
            <h3>تفاصيل العرض</h3>
            <div class="info-item">
              <span class="info-label">ع��د الل��حات:</span>
              ${quote.items.length} لوحة
            </div>
            <div class="info-item">
              <span class="info-label">نوع الزبون:</span>
              ${this.getCustomerTypeLabel(quote.customerInfo.type)}
            </div>
            <div class="info-item">
              <span class="info-label">الباقة:</span>
              ${quote.packageInfo.label}
            </div>
            <div class="info-item">
              <span class="info-label">الخصم:</span>
              ${quote.packageInfo.discount}%
            </div>
            <div class="info-item">
              <span class="info-label">العملة:</span>
              ${quote.currency}
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>م</th>
              <th>صورة اللوحة</th>
              <th>اسم اللوحة</th>
              <th>الموقع</th>
              <th>المقاس</th>
              <th>قائمة السعر</th>
              <th>السعر الأساسي</th>
              <th>الخصم</th>
              <th>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            ${quote.items.map((item, index) => `
              <tr style="height: 80px;">
                <td>${index + 1}</td>
                <td style="text-align: center; padding: 4px;">
                  ${item.imageUrl ? `
                    <img src="${item.imageUrl}"
                         alt="صورة اللوحة ${item.name}"
                         style="width: 60px; height: 40px; object-fit: cover; border-radius: 4px; border: 1px solid #D4AF37;"
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <div style="display: none; width: 60px; height: 40px; background: #f8f9fa; border: 1px solid #D4AF37; border-radius: 4px; align-items: center; justify-content: center; font-size: 8px; color: #666;">
                      <span>صورة اللوحة</span>
                    </div>
                  ` : `
                    <div style="width: 60px; height: 40px; background: #f8f9fa; border: 1px solid #D4AF37; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 8px; color: #666; margin: 0 auto;">
                      <span>صورة اللوحة</span>
                    </div>
                  `}
                </td>
                <td style="text-align: right; padding-right: 8px; font-size: 10px;">${item.name}</td>
                <td style="text-align: right; padding-right: 8px; font-size: 9px;">${item.location}</td>
                <td style="font-size: 9px;">${item.size}</td>
                <td style="font-size: 9px; font-weight: bold; color: #D4AF37;">تلقائي</td>
                <td class="price" style="font-size: 9px;">
                  ${item.basePrice.toLocaleString()} ${quote.currency}
                  <br>
                  <span style="font-size: 8px; color: #666;">للمدة</span>
                </td>
                <td style="font-size: 9px; color: #e53e3e;">
                  ${item.discount > 0 ? `${item.discount}%` : 'لا يوجد'}
                </td>
                <td class="price" style="font-size: 10px; font-weight: bold;">
                  ${item.total.toLocaleString()} ${quote.currency}
                  <br>
                  <span style="font-size: 8px; color: #666;">لـ ${item.duration} ${item.duration === 1 ? 'شهر' : 'شهر'}</span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="totals-section">
          <div class="total-row">
            <span>المجموع قبل الخصم:</span>
            <span class="price">${quote.subtotal.toLocaleString()} ${quote.currency}</span>
          </div>
          <div class="total-row" style="color: #e53e3e;">
            <span>إجمالي الخصم (${quote.packageInfo.discount}%):</span>
            <span class="price">- ${quote.totalDiscount.toLocaleString()} ${quote.currency}</span>
          </div>
          <div class="total-row">
            <span>المجموع بعد الخصم:</span>
            <span class="price">${(quote.subtotal - quote.totalDiscount).toLocaleString()} ${quote.currency}</span>
          </div>
          ${quote.tax > 0 ? `
          <div class="total-row">
            <span>الضريبة (${(quote.taxRate * 100).toFixed(1)}%):</span>
            <span class="price">${quote.tax.toLocaleString()} ${quote.currency}</span>
          </div>
          ` : ''}
          <div class="total-row final">
            <span>الإجمالي النهائي:</span>
            <span>${quote.total.toLocaleString()} ${quote.currency}</span>
          </div>
          <div style="margin-top: 15px; padding: 10px; background: #e6fffa; border: 1px solid #38b2ac; border-radius: 6px;">
            <div style="text-align: center; color: #38b2ac; font-weight: bold; font-size: 12px;">
              🎉 وفرت ${quote.totalDiscount.toLocaleString()} ${quote.currency} مع باقة "${quote.packageInfo.label}"!
            </div>
          </div>
        </div>

        <div class="terms">
          <h3>الشروط والأحكام</h3>
          <ul>
            <li>هذا العرض صالح لمدة 30 يوماً من تاريخ الإصدار</li>
            <li>الأسعار تحدد تلقائياً حسب تصنيف اللوحة (A أو B)</li>
            <li>يتم الدفع مقدماً قبل بدء الحملة الإعلانية</li>
            <li>في حالة إلغاء الحجز، يتم استرداد 50% من المبلغ المدفوع</li>
            <li>الشركة غير مسؤولة ��ن أي أضرار طبيعية قد تلحق باللوحة</li>
            <li>يحق للشركة تغيير موقع اللوحة في حالات الضرورة القصوى</li>
          </ul>
        </div>

        <div class="footer">
          <p>الفارس الذهبي للدعاية والإعلان | هاتف: 218913228908+ | البريد: g.faris.business@gmail.com</p>
          <p>نشكركم لثقتكم بخدماتنا ونتطلع للعمل معكم</p>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
              setTimeout(function() {
                window.close();
              }, 1000);
            }, 500);
          };
        </script>
      </body>
      </html>
    `

    return printContent
  }

  /**
   * ترجمة فئة الزبون إلى العربية
   */
  getCustomerTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      marketers: 'المسوقين',
      individuals: 'العاديين',
      companies: 'الشركات'
    }
    return labels[type] || 'غير محدد'
  }
}

export const newPricingService = new NewPricingService()
