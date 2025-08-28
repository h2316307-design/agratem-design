import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Info,
  PlayCircle,
  Database,
  Settings,
  FileSpreadsheet,
  RotateCcw
} from 'lucide-react'
import { PricingSystemTest, quickSystemTest, getSystemInfo } from '@/utils/pricingSystemTest'
import { usePricingZoneSync } from '@/hooks/usePricingZoneSync'

/**
 * مكون لعرض حالة النظام واختباره
 */
const PricingSystemStatus: React.FC = () => {
  const [testResults, setTestResults] = useState<string>('')
  const [systemInfo, setSystemInfo] = useState<string>('')
  const [isTestRunning, setIsTestRunning] = useState(false)
  const [isInfoLoading, setIsInfoLoading] = useState(false)

  const { 
    isLoading, 
    needsSync, 
    error, 
    analysis,
    checkSyncStatus, 
    syncWithExcel,
    getSyncStats 
  } = usePricingZoneSync()

  // تحميل معلومات النظام عند التحميل
  useEffect(() => {
    loadSystemInfo()
  }, [])

  const runSystemTest = async () => {
    setIsTestRunning(true)
    try {
      const result = await quickSystemTest()
      setTestResults(result)
    } catch (error: any) {
      setTestResults(`❌ خطأ في تشغيل الاختبار: ${error.message}`)
    } finally {
      setIsTestRunning(false)
    }
  }

  const loadSystemInfo = async () => {
    setIsInfoLoading(true)
    try {
      const info = await getSystemInfo()
      setSystemInfo(info)
    } catch (error: any) {
      setSystemInfo(`❌ خطأ في تحميل معلومات النظام: ${error.message}`)
    } finally {
      setIsInfoLoading(false)
    }
  }

  const handleSync = async () => {
    try {
      const result = await syncWithExcel()
      if (result.success) {
        await loadSystemInfo() // تحديث المعلومات بعد المزامنة
      }
    } catch (error) {
      console.error('خطأ في المزامنة:', error)
    }
  }

  const syncStats = getSyncStats()

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          حالة نظام إدارة المناطق السعرية
        </h1>
        <p className="text-gray-600">
          مراقبة وتشخيص النظام الجديد لمزامنة المناطق السعرية مع ملف الإكسل
        </p>
      </div>

      {/* حالة المزامنة */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <RotateCcw className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold">حالة المزامنة</h2>
          </div>
          <Button
            onClick={checkSyncStatus}
            variant="outline"
            size="sm"
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            تحديث
          </Button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-semibold">خطأ: {error}</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {syncStats?.totalMunicipalities || 0}
            </div>
            <div className="text-sm text-blue-700">إجمالي البلديات</div>
          </div>
          
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {syncStats?.existingZones || 0}
            </div>
            <div className="text-sm text-green-700">مناطق موجودة</div>
          </div>
          
          <div className="text-center p-3 bg-orange-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">
              {syncStats?.missingZones || 0}
            </div>
            <div className="text-sm text-orange-700">مناطق مفقودة</div>
          </div>
          
          <div className="text-center p-3 bg-purple-50 rounded-lg">
            <Badge className={`${needsSync ? 'bg-orange-500' : 'bg-green-500'} text-white`}>
              {needsSync ? 'يحتاج مزامنة' : 'محدث'}
            </Badge>
          </div>
        </div>

        {needsSync && (
          <div className="mb-4">
            <Button
              onClick={handleSync}
              disabled={isLoading}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {isLoading ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4 mr-2" />
              )}
              مزامنة المناطق الآن
            </Button>
          </div>
        )}

        {analysis && analysis.missingZones.length > 0 && (
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <h4 className="font-bold text-orange-900 mb-2">المناطق الجديدة المكتشفة:</h4>
            <div className="flex flex-wrap gap-2">
              {analysis.missingZones.map(zone => (
                <Badge key={zone} variant="outline" className="text-orange-800 border-orange-300">
                  {zone}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* اختبار النظام */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <PlayCircle className="w-6 h-6 text-green-600" />
            <h2 className="text-xl font-bold">اختبار النظام</h2>
          </div>
          <Button
            onClick={runSystemTest}
            disabled={isTestRunning}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {isTestRunning ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <PlayCircle className="w-4 h-4 mr-2" />
            )}
            تشغيل الاختبار
          </Button>
        </div>

        {testResults && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <pre className="text-sm whitespace-pre-wrap text-gray-800">
              {testResults}
            </pre>
          </div>
        )}
      </Card>

      {/* معلومات النظام */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Database className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl font-bold">معلومات النظام</h2>
          </div>
          <Button
            onClick={loadSystemInfo}
            variant="outline"
            size="sm"
            disabled={isInfoLoading}
          >
            {isInfoLoading ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Info className="w-4 h-4 mr-2" />
            )}
            تحديث
          </Button>
        </div>

        {systemInfo && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <pre className="text-sm whitespace-pre-wrap text-gray-800">
              {systemInfo}
            </pre>
          </div>
        )}
      </Card>

      {/* إرشادات الاستخدام */}
      <Card className="p-6 bg-blue-50 border-blue-200">
        <div className="flex items-center gap-3 mb-4">
          <FileSpreadsheet className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-bold text-blue-900">كيفية استخدام النظام</h2>
        </div>
        
        <div className="space-y-3 text-blue-800">
          <div className="flex items-start gap-2">
            <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <strong>المزامنة التلقائية:</strong> يقوم النظام بقراءة ملف billboards.xlsx واستخراج جميع البلديات تلقائياً
            </div>
          </div>
          
          <div className="flex items-start gap-2">
            <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <strong>إنشاء مناطق جديدة:</strong> يتم إنشاء مناطق سعرية جديدة تلقائياً للبلديات الجديدة المكتشفة
            </div>
          </div>
          
          <div className="flex items-start gap-2">
            <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <strong>حفظ التغييرات:</strong> جميع التعديلات على الأسعار يتم حفظها تلقائياً في النظام
            </div>
          </div>
          
          <div className="flex items-start gap-2">
            <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <strong>معاملات البلديات:</strong> يتم تطبيق معاملات الضرب لكل بلدية تلقائياً على الأسعار
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

export default PricingSystemStatus
