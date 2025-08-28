import { useState, useEffect, useCallback } from 'react'
import { pricingZoneAutoManager, PricingZoneAnalysis } from '@/services/pricingZoneAutoManager'
import { newPricingService } from '@/services/newPricingService'

interface SyncState {
  isLoading: boolean
  needsSync: boolean
  lastSync?: string
  analysis?: PricingZoneAnalysis
  error?: string
}

interface SyncResult {
  success: boolean
  summary?: any
  error?: string
}

/**
 * Hook لإدارة مزامنة المناطق السعرية مع ملف الإكسل
 */
export const usePricingZoneSync = () => {
  const [syncState, setSyncState] = useState<SyncState>({
    isLoading: false,
    needsSync: false
  })

  /**
   * فحص الحاجة للمزامنة
   */
  const checkSyncStatus = useCallback(async () => {
    try {
      setSyncState(prev => ({ ...prev, isLoading: true, error: undefined }))
      
      const syncCheck = await newPricingService.checkNeedForSync()
      const analysis = await pricingZoneAutoManager.analyzePricingZones()
      
      setSyncState(prev => ({
        ...prev,
        isLoading: false,
        needsSync: syncCheck.needsSync,
        analysis: analysis.success ? analysis : undefined
      }))

      return { needsSync: syncCheck.needsSync, analysis }
      
    } catch (error: any) {
      setSyncState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message
      }))
      throw error
    }
  }, [])

  /**
   * تنفيذ المزامنة
   */
  const syncWithExcel = useCallback(async (): Promise<SyncResult> => {
    try {
      setSyncState(prev => ({ ...prev, isLoading: true, error: undefined }))
      
      const result = await newPricingService.syncWithExcelData()
      
      if (result.success) {
        setSyncState(prev => ({
          ...prev,
          isLoading: false,
          needsSync: false,
          lastSync: new Date().toISOString()
        }))
        
        // إعادة فحص الحالة بعد المزامنة
        setTimeout(checkSyncStatus, 1000)
      } else {
        setSyncState(prev => ({
          ...prev,
          isLoading: false,
          error: result.error
        }))
      }

      return result
      
    } catch (error: any) {
      setSyncState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message
      }))
      return { success: false, error: error.message }
    }
  }, [checkSyncStatus])

  /**
   * الحصول على معلومات المناطق المفقودة
   */
  const getMissingZones = useCallback((): string[] => {
    return syncState.analysis?.missingZones || []
  }, [syncState.analysis])

  /**
   * الحصول على إحصائيات المزامنة
   */
  const getSyncStats = useCallback(() => {
    if (!syncState.analysis) return null

    return {
      totalMunicipalities: syncState.analysis.totalMunicipalities,
      existingZones: syncState.analysis.existingZones.length,
      missingZones: syncState.analysis.missingZones.length,
      needsSync: syncState.needsSync
    }
  }, [syncState])

  /**
   * إعادة تعيين حالة الخطأ
   */
  const clearError = useCallback(() => {
    setSyncState(prev => ({ ...prev, error: undefined }))
  }, [])

  /**
   * فحص تلقائي عند تحميل المكون
   */
  useEffect(() => {
    checkSyncStatus().catch(console.error)
  }, [checkSyncStatus])

  return {
    // الحالة
    isLoading: syncState.isLoading,
    needsSync: syncState.needsSync,
    lastSync: syncState.lastSync,
    error: syncState.error,
    analysis: syncState.analysis,

    // الإجراءات
    checkSyncStatus,
    syncWithExcel,
    clearError,

    // المساعدات
    getMissingZones,
    getSyncStats
  }
}

/**
 * Hook بسيط للحصول على قائمة المناطق السعرية
 */
export const usePricingZones = () => {
  const [zones, setZones] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const loadZones = useCallback(async () => {
    try {
      setIsLoading(true)
      const pricingZones = newPricingService.getPricingZones()
      setZones(pricingZones)
    } catch (error) {
      console.error('خطأ في تحميل المناطق السعرية:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadZones()
  }, [loadZones])

  return {
    zones,
    isLoading,
    reload: loadZones
  }
}

/**
 * Hook للحصول على معلومات منطقة سعرية محددة
 */
export const usePricingZoneInfo = (zoneName: string) => {
  const [zoneInfo, setZoneInfo] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)

  const loadZoneInfo = useCallback(async () => {
    if (!zoneName) return

    try {
      setIsLoading(true)
      const pricing = newPricingService.getPricing()
      const zone = pricing.zones[zoneName]
      setZoneInfo(zone)
    } catch (error) {
      console.error('خطأ في تحميل معلومات المنطقة:', error)
      setZoneInfo(null)
    } finally {
      setIsLoading(false)
    }
  }, [zoneName])

  useEffect(() => {
    loadZoneInfo()
  }, [loadZoneInfo])

  return {
    zoneInfo,
    isLoading,
    reload: loadZoneInfo
  }
}
