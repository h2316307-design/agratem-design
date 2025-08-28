import { pricingZoneAutoManager } from '@/services/pricingZoneAutoManager'
import { newPricingService } from '@/services/newPricingService'
import { municipalityService } from '@/services/municipalityService'

/**
 * اختبار شامل للنظام الجديد لإدارة المناطق السعرية
 */
export class PricingSystemTest {
  private testResults: Array<{ test: string, passed: boolean, message: string }> = []

  /**
   * تشغيل جميع الاختبارات
   */
  async runAllTests(): Promise<{ success: boolean, results: any[], summary: string }> {
    console.log('🧪 بدء اختبار النظام الجديد لإدارة المناطق السعرية...')
    
    this.testResults = []

    // اختبار 1: فحص خدمة إدارة المناطق التلقائية
    await this.testAutoManagerService()

    // اختبار 2: فحص استخراج البلديات من الإكسل
    await this.testExcelExtraction()

    // اختبار 3: فحص إنشاء مناطق سعرية جديدة
    await this.testZoneCreation()

    // اختبار 4: فحص المزامنة
    await this.testSyncProcess()

    // اختبار 5: فحص خدمة الأسعار المحدثة
    await this.testNewPricingService()

    // إعداد التقرير النهائي
    const passedTests = this.testResults.filter(r => r.passed).length
    const totalTests = this.testResults.length
    const success = passedTests === totalTests

    const summary = `${passedTests}/${totalTests} اختبار نجح${success ? ' ✅' : ' ❌'}`

    console.log(`\n📊 نتائج الاختبار: ${summary}`)
    this.testResults.forEach(result => {
      console.log(`${result.passed ? '✅' : '❌'} ${result.test}: ${result.message}`)
    })

    return {
      success,
      results: this.testResults,
      summary
    }
  }

  /**
   * اختبار خدمة إدارة المناطق التلقائية
   */
  private async testAutoManagerService() {
    try {
      // فحص وجود الخدمة
      if (typeof pricingZoneAutoManager === 'undefined') {
        this.addTestResult('خدمة إدارة المناطق التلقائية', false, 'الخدمة غير متاحة')
        return
      }

      // فحص الدوال الأساسية
      const hasRequiredMethods = [
        'extractUniqueMunicipalitiesFromExcel',
        'analyzePricingZones',
        'createDefaultPricingZone',
        'syncPricingZonesWithExcel'
      ].every(method => typeof (pricingZoneAutoManager as any)[method] === 'function')

      if (hasRequiredMethods) {
        this.addTestResult('خدمة إدارة المناطق التلقائية', true, 'جميع الدوال متاحة')
      } else {
        this.addTestResult('خدمة إدارة المناطق التلقائية', false, 'بعض الدوال مفقودة')
      }

    } catch (error: any) {
      this.addTestResult('خدمة إدارة المناطق التلقائية', false, `خطأ: ${error.message}`)
    }
  }

  /**
   * اختبار استخراج البلديات من الإكسل
   */
  private async testExcelExtraction() {
    try {
      const municipalities = await pricingZoneAutoManager.extractUniqueMunicipalitiesFromExcel()
      
      if (Array.isArray(municipalities) && municipalities.length > 0) {
        this.addTestResult('استخراج البلديات من الإكسل', true, `تم استخراج ${municipalities.length} بلدية`)
      } else {
        this.addTestResult('استخراج البلديات من الإكسل', false, 'لم يتم العثور على بلديات')
      }

    } catch (error: any) {
      this.addTestResult('استخراج البلديات من الإكسل', false, `خطأ: ${error.message}`)
    }
  }

  /**
   * اختبار إنشاء مناطق سعرية جديدة
   */
  private async testZoneCreation() {
    try {
      const testZoneName = 'منطقة_اختبار_' + Date.now()
      const newZone = pricingZoneAutoManager.createDefaultPricingZone(testZoneName)

      if (newZone && newZone.name === testZoneName && newZone.prices) {
        this.addTestResult('إنشاء منطقة سعرية جديدة', true, 'تم إنشاء منطقة اختبارية بنجاح')
      } else {
        this.addTestResult('إنشاء منطقة سعرية جديدة', false, 'فشل في إنشاء منطقة اختبارية')
      }

    } catch (error: any) {
      this.addTestResult('إنشاء منطقة سعرية جديدة', false, `خطأ: ${error.message}`)
    }
  }

  /**
   * اختبار عملية المزامنة
   */
  private async testSyncProcess() {
    try {
      const analysis = await pricingZoneAutoManager.analyzePricingZones()

      if (analysis && typeof analysis.success === 'boolean') {
        if (analysis.success) {
          this.addTestResult('تحليل المناطق السعرية', true, 
            `إجمالي البلديات: ${analysis.totalMunicipalities}, مناطق مفقودة: ${analysis.missingZones.length}`)
        } else {
          this.addTestResult('تحليل المناطق السعرية', false, `أخطاء: ${analysis.errors.join(', ')}`)
        }
      } else {
        this.addTestResult('تحليل المناطق السعرية', false, 'استجابة غير صحيحة من التحليل')
      }

    } catch (error: any) {
      this.addTestResult('تحليل المناطق السعرية', false, `خطأ: ${error.message}`)
    }
  }

  /**
   * اختبار خدمة الأسعار المحدثة
   */
  private async testNewPricingService() {
    try {
      // فحص وجود الخدمة
      if (typeof newPricingService === 'undefined') {
        this.addTestResult('خدمة الأسعار المحدثة', false, 'الخدمة غير متاحة')
        return
      }

      // فحص الدوال الجديدة
      const hasNewMethods = [
        'syncWithExcelData',
        'checkNeedForSync'
      ].every(method => typeof (newPricingService as any)[method] === 'function')

      if (hasNewMethods) {
        // اختبار التحقق من الحاجة للمزامنة
        const syncCheck = await newPricingService.checkNeedForSync()
        
        if (typeof syncCheck.needsSync === 'boolean') {
          this.addTestResult('خدمة الأسعار المحدثة', true, 
            `الدوال متاحة، حالة المزامنة: ${syncCheck.needsSync ? 'يحتاج مزامنة' : 'محدث'}`)
        } else {
          this.addTestResult('خدمة الأسعار المحدثة', false, 'استجابة غير صحيحة من فحص المزامنة')
        }
      } else {
        this.addTestResult('خدمة الأسعار المحدثة', false, 'الدوال الجديدة مفقودة')
      }

    } catch (error: any) {
      this.addTestResult('خدمة الأسعار المحدثة', false, `خطأ: ${error.message}`)
    }
  }

  /**
   * إضافة نتيجة اختبار
   */
  private addTestResult(test: string, passed: boolean, message: string) {
    this.testResults.push({ test, passed, message })
  }

  /**
   * اختبار سريع للنظام
   */
  static async quickTest(): Promise<string> {
    try {
      const tester = new PricingSystemTest()
      const result = await tester.runAllTests()
      
      return `🧪 اختبار النظام: ${result.summary}\n\n${
        result.results.map(r => `${r.passed ? '✅' : '❌'} ${r.test}`).join('\n')
      }`
    } catch (error: any) {
      return `❌ فشل في تشغيل الاختبار: ${error.message}`
    }
  }

  /**
   * عرض معلومات النظام
   */
  static async getSystemInfo(): Promise<string> {
    try {
      const pricingZones = newPricingService.getPricingZones()
      const municipalities = municipalityService.getMunicipalities()
      const stats = municipalityService.getStatistics()

      return `📊 معلومات النظام:
• المناطق السعرية: ${pricingZones.length}
• البلديات المسجلة: ${municipalities.length}  
• المناطق: ${stats.regionsCount}
• المدن: ${stats.citiesCount}
• متوسط المعامل: ${stats.averageMultiplier}

🔧 المناطق السعرية المتاحة:
${pricingZones.map(zone => `  - ${zone}`).join('\n')}

🏘️ البلديات المسجلة:
${municipalities.slice(0, 10).map(m => `  - ${m.name} (${m.multiplier})`).join('\n')}${
        municipalities.length > 10 ? `\n  ... و ${municipalities.length - 10} بلدية أخرى` : ''
      }`

    } catch (error: any) {
      return `❌ خطأ في الحصول على معلومات النظام: ${error.message}`
    }
  }
}

// تصدير لسهولة الاستخدام
export const quickSystemTest = PricingSystemTest.quickTest
export const getSystemInfo = PricingSystemTest.getSystemInfo
