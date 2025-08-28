import { Billboard, PriceList, BillboardSize, PricingZone, DurationPricing } from '@/types'
import { loadBillboardsFromExcel } from './billboardService'
import { newPricingService } from './newPricingService'
import { municipalityService } from './municipalityService'

export interface PricingZoneAnalysis {
  totalMunicipalities: number
  existingZones: string[]
  missingZones: string[]
  newZonesCreated: string[]
  success: boolean
  errors: string[]
}

/**
 * خدمة إدارة المناطق السعرية التلقائية
 * تقوم بقراءة ملف الإكسل واستخراج المناطق السعرية وإنشاء مناطق جديدة حسب الحاجة
 */
class PricingZoneAutoManager {
  private readonly DEFAULT_ZONE_BASE = 'مصراتة' // المنطقة الأساسية للنسخ
  
  constructor() {
    // Initialize the service
  }

  /**
   * استخراج جميع البلديات الفريدة من ملف الإكسل
   */
  async extractUniqueMunicipalitiesFromExcel(): Promise<string[]> {
    try {
      console.log('[PricingZoneAutoManager] بدء استخراج البلديات من ملف الإكسل...')
      
      const billboards = await loadBillboardsFromExcel()
      
      // استخراج جميع البلديات الفريدة
      const municipalities = new Set<string>()
      
      billboards.forEach(billboard => {
        if (billboard.municipality && billboard.municipality.trim() !== '' && billboard.municipality !== 'غير ��حدد') {
          municipalities.add(billboard.municipality.trim())
        }
      })
      
      const uniqueMunicipalities = Array.from(municipalities).sort()
      
      console.log(`[PricingZoneAutoManager] تم العثور على ${uniqueMunicipalities.length} بلدية فريدة:`, uniqueMunicipalities)
      
      return uniqueMunicipalities
    } catch (error) {
      console.error('[PricingZoneAutoManager] خطأ في استخراج البلديات من الإكسل:', error)
      return []
    }
  }

  /**
   * تحليل المناطق السعرية ومقارنتها مع البلديات الموجودة
   */
  async analyzePricingZones(): Promise<PricingZoneAnalysis> {
    const result: PricingZoneAnalysis = {
      totalMunicipalities: 0,
      existingZones: [],
      missingZones: [],
      newZonesCreated: [],
      success: false,
      errors: []
    }

    try {
      // استخراج البلديات من الإكسل
      const municipalities = await this.extractUniqueMunicipalitiesFromExcel()
      result.totalMunicipalities = municipalities.length

      if (municipalities.length === 0) {
        result.errors.push('لم يتم العثور على بلديات في ملف الإكسل')
        return result
      }

      // الحصول على المناطق السعرية الموجودة
      const pricing = newPricingService.getPricing()
      const existingZones = Object.keys(pricing.zones)
      
      console.log('[PricingZoneAutoManager] المناطق السعرية الموجودة:', existingZones)

      // تصنيف البلديات
      municipalities.forEach(municipality => {
        const zoneName = municipality.trim()
        
        if (existingZones.includes(zoneName)) {
          result.existingZones.push(zoneName)
        } else {
          result.missingZones.push(zoneName)
        }
      })

      console.log(`[PricingZoneAutoManager] مناطق موجودة: ${result.existingZones.length}`)
      console.log(`[PricingZoneAutoManager] مناطق مفقودة: ${result.missingZones.length}`)

      result.success = true
      
    } catch (error: any) {
      console.error('[PricingZoneAutoManager] خطأ في تحليل المناطق السعرية:', error)
      result.errors.push(`خطأ في التحليل: ${error.message}`)
    }

    return result
  }

  /**
   * إنشاء منطقة سعرية جديدة بأسعار افتراضية
   */
  createDefaultPricingZone(zoneName: string, baseZone: string = this.DEFAULT_ZONE_BASE): PricingZone {
    // الحصول على المنطقة الأسا��ية للنسخ
    const pricing = newPricingService.getPricing()
    const baseZoneData = pricing.zones[baseZone] || pricing.zones[Object.keys(pricing.zones)[0]]

    if (!baseZoneData) {
      // إنشاء منطقة افتراضية إذا لم توجد منطقة أساسية
      return this.createBasicDefaultZone(zoneName)
    }

    // نسخ أسعار المنطقة الأساسية مع تطبيق معامل البلدية
    const municipalityMultiplier = this.getMunicipalityMultiplier(zoneName)
    
    // نسخ الأسعار العادية مع تطبيق المعامل
    const adjustedPrices: any = {}
    Object.keys(baseZoneData.prices).forEach(customerType => {
      adjustedPrices[customerType] = {}
      Object.keys(baseZoneData.prices[customerType]).forEach(size => {
        const basePrice = baseZoneData.prices[customerType][size]
        adjustedPrices[customerType][size] = Math.round(basePrice * municipalityMultiplier)
      })
    })

    // نسخ أسعار A/B مع تطبيق المعامل
    const adjustedABPrices: any = {}
    Object.keys(baseZoneData.abPrices || {}).forEach(priceList => {
      adjustedABPrices[priceList] = {}
      Object.keys(baseZoneData.abPrices![priceList]).forEach(duration => {
        adjustedABPrices[priceList][duration] = {}
        Object.keys(baseZoneData.abPrices![priceList][duration]).forEach(size => {
          const basePrice = baseZoneData.abPrices![priceList][duration][size]
          adjustedABPrices[priceList][duration][size] = Math.round(basePrice * municipalityMultiplier)
        })
      })
    })

    return {
      name: zoneName,
      prices: adjustedPrices,
      abPrices: adjustedABPrices
    }
  }

  /**
   * إنشاء منطقة افتراضية أساسية
   */
  private createBasicDefaultZone(zoneName: string): PricingZone {
    const defaultSizes: BillboardSize[] = ['5x13', '4x12', '4x10', '3x8', '3x6', '3x4']
    const municipalityMultiplier = this.getMunicipalityMultiplier(zoneName)

    // أسعار أساسية افتراضية
    const basePrices: Record<BillboardSize, number> = {
      '5x13': Math.round(3500 * municipalityMultiplier),
      '4x12': Math.round(2800 * municipalityMultiplier),
      '4x10': Math.round(2200 * municipalityMultiplier),
      '3x8': Math.round(1500 * municipalityMultiplier),
      '3x6': Math.round(1000 * municipalityMultiplier),
      '3x4': Math.round(800 * municipalityMultiplier)
    }

    // إنشاء أسعار لفئات الزبائن المختلفة
    const prices = {
      marketers: { ...basePrices }, // نفس الأسعار الأساسية للمسوقين
      individuals: { ...basePrices },
      companies: {}
    }

    // أسعار الشركات أعلى بـ 15%
    defaultSizes.forEach(size => {
      prices.companies[size] = Math.round(basePrices[size] * 1.15)
    })

    // إنشاء أسعار A/B مع خصومات المدد
    const createDurationPricing = (basePrice: number): DurationPricing => ({
      '1': basePrice, // شهر واحد - سعر كامل
      '3': Math.round(basePrice * 0.95), // 3 أشهر - خصم 5%
      '6': Math.round(basePrice * 0.90), // 6 أشهر - خصم 10%
      '12': Math.round(basePrice * 0.80) // سنة - خصم 20%
    })

    const abPrices = {
      A: {},
      B: {}
    }

    defaultSizes.forEach(size => {
      abPrices.A[size] = createDurationPricing(basePrices[size])
      abPrices.B[size] = createDurationPricing(Math.round(basePrices[size] * 1.2)) // قائمة B أعلى بـ 20%
    })

    return {
      name: zoneName,
      prices,
      abPrices
    }
  }

  /**
   * الحصول على معامل البلدية
   */
  private getMunicipalityMultiplier(municipalityName: string): number {
    try {
      const municipality = municipalityService.getMunicipalityByName(municipalityName)
      return municipality?.multiplier || 1.0
    } catch {
      return 1.0
    }
  }

  /**
   * إنشاء جميع المناطق السعرية المفقودة
   */
  async createMissingPricingZones(analysis?: PricingZoneAnalysis): Promise<PricingZoneAnalysis> {
    let result = analysis
    
    if (!result) {
      result = await this.analyzePricingZones()
    }

    if (!result.success || result.missingZones.length === 0) {
      return result
    }

    try {
      console.log(`[PricingZoneAutoManager] إنشاء ${result.missingZones.length} منطقة سعرية جديدة...`)
      
      const pricing = newPricingService.getPricing()
      const updatedPricing: PriceList = { ...pricing }

      // إنشاء كل منطقة مفقودة
      result.missingZones.forEach(zoneName => {
        try {
          console.log(`[PricingZoneAutoManager] إنشاء منطقة سعرية: ${zoneName}`)
          
          const newZone = this.createDefaultPricingZone(zoneName)
          updatedPricing.zones[zoneName] = newZone
          result!.newZonesCreated.push(zoneName)
          
          console.log(`[PricingZoneAutoManager] تم إنشاء منطقة ${zoneName} بنجاح`)
        } catch (error: any) {
          console.error(`[PricingZoneAutoManager] فشل في إنشاء منطقة ${zoneName}:`, error)
          result!.errors.push(`فشل في إنشاء منطقة ${zoneName}: ${error.message}`)
        }
      })

      // حفظ المناطق الجديدة
      const saveResult = newPricingService.updatePricing(updatedPricing)
      
      if (saveResult.success) {
        console.log(`[PricingZoneAutoManager] تم حفظ ${result.newZonesCreated.length} منطقة سعرية جديدة`)
      } else {
        result.errors.push(`فشل في حفظ المناطق الجديدة: ${saveResult.error}`)
      }

    } catch (error: any) {
      console.error('[PricingZoneAutoManager] خطأ في إنشاء المناطق المفقودة:', error)
      result.errors.push(`خطأ عام في إنشاء المناطق: ${error.message}`)
    }

    return result
  }

  /**
   * مزامنة كاملة للمناطق السعرية مع ملف الإكسل
   */
  async syncPricingZonesWithExcel(): Promise<PricingZoneAnalysis> {
    console.log('[PricingZoneAutoManager] بدء المزامنة الكاملة للمناطق السعرية...')
    
    try {
      // تحليل المناطق السعرية
      const analysis = await this.analyzePricingZones()
      
      if (!analysis.success) {
        return analysis
      }

      // إنشاء المناطق المفقودة
      const result = await this.createMissingPricingZones(analysis)
      
      console.log('[PricingZoneAutoManager] تمت المزامنة بنجاح!')
      console.log(`- إجمالي البلديات: ${result.totalMunicipalities}`)
      console.log(`- مناطق موجودة: ${result.existingZones.length}`)
      console.log(`- مناطق جديدة: ${result.newZonesCreated.length}`)
      
      if (result.errors.length > 0) {
        console.warn('[PricingZoneAutoManager] أخطاء حدثت أثناء المزامنة:', result.errors)
      }

      return result
      
    } catch (error: any) {
      console.error('[PricingZoneAutoManager] فشل في المزامنة:', error)
      
      return {
        totalMunicipalities: 0,
        existingZones: [],
        missingZones: [],
        newZonesCreated: [],
        success: false,
        errors: [`فشل في المزامنة: ${error.message}`]
      }
    }
  }

  /**
   * إضافة منطقة سعرية يدوياً
   */
  async addPricingZoneManually(zoneName: string, baseZone?: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!zoneName || zoneName.trim() === '') {
        return { success: false, error: 'اسم المنطقة مطلوب' }
      }

      const trimmedName = zoneName.trim()
      
      // التح��ق من وجود المنطقة
      const pricing = newPricingService.getPricing()
      if (pricing.zones[trimmedName]) {
        return { success: false, error: 'المنطقة موجودة بالفعل' }
      }

      // إنشاء المنطقة الجديدة
      const newZone = this.createDefaultPricingZone(trimmedName, baseZone)
      pricing.zones[trimmedName] = newZone

      // حفظ التحديثات
      const saveResult = newPricingService.updatePricing(pricing)
      
      if (saveResult.success) {
        console.log(`[PricingZoneAutoManager] تم إضافة منطقة ${trimmedName} يدوياً`)
        return { success: true }
      } else {
        return { success: false, error: saveResult.error }
      }

    } catch (error: any) {
      console.error('[PricingZoneAutoManager] خطأ في إضافة المنطقة يدوياً:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * حذف منطقة سعرية
   */
  async removePricingZone(zoneName: string): Promise<{ success: boolean; error?: string }> {
    try {
      const pricing = newPricingService.getPricing()
      
      if (!pricing.zones[zoneName]) {
        return { success: false, error: 'المنطقة غير موجودة' }
      }

      // التحقق من عدم كونها المنطقة الوحيدة
      const zoneCount = Object.keys(pricing.zones).length
      if (zoneCount <= 1) {
        return { success: false, error: 'لا يمكن حذف آخر منطقة سعرية' }
      }

      // حذف المنطقة
      delete pricing.zones[zoneName]

      // حفظ التحديثات
      const saveResult = newPricingService.updatePricing(pricing)
      
      if (saveResult.success) {
        console.log(`[PricingZoneAutoManager] تم حذف منطقة ${zoneName}`)
        return { success: true }
      } else {
        return { success: false, error: saveResult.error }
      }

    } catch (error: any) {
      console.error('[PricingZoneAutoManager] خطأ في حذف المنطقة:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * تحديث أسعار منطقة معينة
   */
  async updateZonePricing(zoneName: string, updates: Partial<PricingZone>): Promise<{ success: boolean; error?: string }> {
    try {
      const pricing = newPricingService.getPricing()
      
      if (!pricing.zones[zoneName]) {
        return { success: false, error: 'المنطقة غير موجودة' }
      }

      // تحديث بيانات المنطقة
      pricing.zones[zoneName] = {
        ...pricing.zones[zoneName],
        ...updates
      }

      // حفظ التحديثات
      const saveResult = newPricingService.updatePricing(pricing)
      
      if (saveResult.success) {
        console.log(`[PricingZoneAutoManager] تم تحديث أسعار منطقة ${zoneName}`)
        return { success: true }
      } else {
        return { success: false, error: saveResult.error }
      }

    } catch (error: any) {
      console.error('[PricingZoneAutoManager] خطأ في تحديث أسعار المنطقة:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * الحصول على إحصائيات المناطق السعرية
   */
  getPricingZonesStatistics(): {
    totalZones: number
    zonesWithMunicipalities: number
    averagePricesA: Record<string, number>
    averagePricesB: Record<string, number>
  } {
    const pricing = newPricingService.getPricing()
    const zones = Object.keys(pricing.zones)
    
    const stats = {
      totalZones: zones.length,
      zonesWithMunicipalities: 0,
      averagePricesA: {} as Record<string, number>,
      averagePricesB: {} as Record<string, number>
    }

    // حساب المتوسطات لكل حجم
    const sizes = newPricingService.sizes || ['5x13', '4x12', '4x10', '3x8', '3x6', '3x4']
    
    sizes.forEach(size => {
      const pricesA: number[] = []
      const pricesB: number[] = []

      zones.forEach(zoneName => {
        const zone = pricing.zones[zoneName]
        
        // التحقق من وجود municipality
        const municipality = municipalityService.getMunicipalityByName(zoneName)
        if (municipality) {
          stats.zonesWithMunicipalities++
        }

        // جمع أسعار A و B للمدة الشهرية
        if (zone.abPrices?.A?.['1']?.[size]) {
          pricesA.push(zone.abPrices.A['1'][size])
        }
        if (zone.abPrices?.B?.['1']?.[size]) {
          pricesB.push(zone.abPrices.B['1'][size])
        }
      })

      // حساب المتوسط
      stats.averagePricesA[size] = pricesA.length > 0 
        ? Math.round(pricesA.reduce((a, b) => a + b, 0) / pricesA.length)
        : 0
      
      stats.averagePricesB[size] = pricesB.length > 0 
        ? Math.round(pricesB.reduce((a, b) => a + b, 0) / pricesB.length)
        : 0
    })

    return stats
  }
}

export const pricingZoneAutoManager = new PricingZoneAutoManager()
