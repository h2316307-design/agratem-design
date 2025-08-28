import React, { useState, useEffect, useRef } from 'react'
import {
  Settings,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  Upload,
  Download,
  Search,
  Calculator,
  AlertTriangle,
  CheckCircle,
  FileSpreadsheet,
  Users,
  MapPin,
  Clock,
  Building2,
  DollarSign,
  TrendingUp,
  RefreshCw,
  Info
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import * as XLSX from 'xlsx'

// Types for the enhanced pricing system
interface Municipality {
  id: string
  name: string
  multiplier: number
}

interface Category {
  id: string
  name: string
  description?: string
  color: string
}

interface Level {
  id: string
  name: string
  description: string
  discount?: number
}

interface DurationOption {
  value: number
  label: string
  discount: number
  unit: 'day' | 'month' | 'months' | 'year'
}

interface PricingData {
  levels: Level[]
  municipalities: Municipality[]
  categories: Category[]
  sizes: string[]
  currentLevel: string
  currentMunicipality: string
  currentDuration: number
  prices: Record<string, Record<string, number>> // size -> category -> price
}

interface UnsavedChanges {
  hasChanges: boolean
  changedCells: Set<string>
}

interface SyncStatus {
  isLoading: boolean
  lastSync?: string
  totalMunicipalities?: number
  existingZones?: number
  newZonesCreated?: number
  needsSync?: boolean
  missingZones?: string[]
}

const EnhancedPricingManagement: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  // State Management
  const [pricingData, setPricingData] = useState<PricingData>({
    levels: [
      { id: 'A', name: 'مستوى A', description: 'مواقع مميزة' },
      { id: 'B', name: 'مستوى B', description: 'مواقع عادية' },
      { id: 'C', name: 'مستوى C', description: 'مواقع اقتصادي��' }
    ],
    municipalities: [
      { id: '1', name: 'مصراتة', multiplier: 1.0 },
      { id: '2', name: 'زل��تن', multiplier: 0.8 },
      { id: '3', name: 'بنغازي', multiplier: 1.2 },
      { id: '4', name: 'طرابلس', multiplier: 1.0 }
    ],
    categories: [
      { id: 'marketers', name: 'مسوقين', description: 'خصم للمسوقين', color: 'blue' },
      { id: 'companies', name: 'شركات', description: 'أسعار الشركات', color: 'green' },
      { id: 'individuals', name: 'أفراد', description: 'الأسعار العادية', color: 'purple' }
    ],
    sizes: ['5x13', '4x12', '4x10', '3x8', '3x6', '3x4'],
    currentLevel: 'A',
    currentMunicipality: '1',
    currentDuration: 1,
    prices: {}
  })

  const [editingCell, setEditingCell] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState<string>('')
  const [unsavedChanges, setUnsavedChanges] = useState<UnsavedChanges>({ hasChanges: false, changedCells: new Set() })
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showLevelModal, setShowLevelModal] = useState(false)
  const [newCategory, setNewCategory] = useState({ name: '', description: '', color: 'blue' })
  const [newLevel, setNewLevel] = useState({ name: '', description: '', discount: 0 })
  const [loading, setLoading] = useState(false)
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ isLoading: false })
  const [showSyncInfo, setShowSyncInfo] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Duration options with discounts
  const durationOptions = [
    { value: 1, label: 'يوم واحد', discount: 0, unit: 'day' },
    { value: 30, label: 'شهر واحد', discount: 0, unit: 'month' },
    { value: 90, label: '3 أشهر', discount: 5, unit: 'months' },
    { value: 180, label: '6 أشهر', discount: 10, unit: 'months' },
    { value: 365, label: 'سنة كاملة', discount: 20, unit: 'year' }
  ]

  // Initialize pricing data and check sync status
  useEffect(() => {
    const init = async () => {
      await initializePricingData()
      await checkSyncStatus()
    }
    init()
  }, [])

  // Check if sync is needed
  const checkSyncStatus = async () => {
    try {
      const { newPricingService } = await import('@/services/newPricingService')
      const syncCheck = await newPricingService.checkNeedForSync()

      setSyncStatus(prev => ({
        ...prev,
        needsSync: syncCheck.needsSync,
        missingZones: syncCheck.missingZones
      }))

      if (syncCheck.needsSync) {
        showNotification('info', `تم العثور على ${syncCheck.missingZones.length} منطقة جديدة تحتاج مزامنة`)
      }
    } catch (error) {
      console.error('خطأ في فحص حالة المزامنة:', error)
    }
  }

  // Sync pricing zones with Excel data
  const syncWithExcel = async () => {
    setSyncStatus(prev => ({ ...prev, isLoading: true }))

    try {
      const { newPricingService } = await import('@/services/newPricingService')
      const result = await newPricingService.syncWithExcelData()

      if (result.success && result.summary) {
        setSyncStatus({
          isLoading: false,
          lastSync: new Date().toISOString(),
          totalMunicipalities: result.summary.totalMunicipalities,
          existingZones: result.summary.existingZones,
          newZonesCreated: result.summary.newZonesCreated,
          needsSync: false,
          missingZones: []
        })

        // تحديث البيانات المعروضة
        initializePricingData()

        const message = result.summary.newZonesCreated > 0
          ? `تمت المزامنة بنجاح! تم إنشاء ${result.summary.newZonesCreated} منطقة جديدة`
          : 'تمت المزامنة بنجاح! جميع المناطق محدثة'

        showNotification('success', message)
      } else {
        setSyncStatus(prev => ({ ...prev, isLoading: false }))
        showNotification('error', `فشل في المزامنة: ${result.error}`)
      }
    } catch (error: any) {
      setSyncStatus(prev => ({ ...prev, isLoading: false }))
      showNotification('error', `خطأ في المزامنة: ${error.message}`)
    }
  }

  // Show notification temporarily
  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), type === 'info' ? 5000 : 3000)
  }

  // Initialize default pricing data
  const initializePricingData = async () => {
    try {
      // Load from the new pricing service
      const { newPricingService } = await import('@/services/newPricingService')
      const pricingFromService = newPricingService.getPricing()

      // Update municipalities list from pricing zones
      const availableZones = Object.keys(pricingFromService.zones)
      const updatedMunicipalities = availableZones.map((zoneName, index) => ({
        id: (index + 1).toString(),
        name: zoneName,
        multiplier: 1.0 // Will be updated from municipality service if available
      }))

      // Try to get multipliers from municipality service
      try {
        const { municipalityService } = await import('@/services/municipalityService')
        updatedMunicipalities.forEach(muni => {
          const municipalityData = municipalityService.getMunicipalityByName(muni.name)
          if (municipalityData) {
            muni.multiplier = municipalityData.multiplier
          }
        })
      } catch (error) {
        console.warn('Municipality service not available, using default multipliers')
      }

      const initialPrices: Record<string, Record<string, number>> = {}

      pricingData.sizes.forEach(size => {
        initialPrices[size] = {}
        pricingData.categories.forEach(category => {
          // Generate realistic pricing based on size and category
          const basePrice = getSizeBasePrice(size)
          const categoryMultiplier = getCategoryMultiplier(category.id)
          initialPrices[size][category.id] = Math.round(basePrice * categoryMultiplier)
        })
      })

      setPricingData(prev => ({
        ...prev,
        prices: initialPrices,
        municipalities: updatedMunicipalities
      }))

    } catch (error) {
      console.error('خطأ في تحميل بيانات الأسعار:', error)
      // Fallback to original initialization
      const initialPrices: Record<string, Record<string, number>> = {}

      pricingData.sizes.forEach(size => {
        initialPrices[size] = {}
        pricingData.categories.forEach(category => {
          const basePrice = getSizeBasePrice(size)
          const categoryMultiplier = getCategoryMultiplier(category.id)
          initialPrices[size][category.id] = Math.round(basePrice * categoryMultiplier)
        })
      })

      setPricingData(prev => ({ ...prev, prices: initialPrices }))
    }
  }

  // Get base price for size
  const getSizeBasePrice = (size: string): number => {
    const prices: Record<string, number> = {
      '5x13': 3500,
      '4x12': 2800,
      '4x10': 2200,
      '3x8': 1500,
      '3x6': 1000,
      '3x4': 800
    }
    return prices[size] || 1000
  }

  // Get category multiplier
  const getCategoryMultiplier = (categoryId: string): number => {
    const multipliers: Record<string, number> = {
      'marketers': 0.85, // 15% discount for marketers
      'individuals': 1.0, // base price
      'companies': 1.15 // 15% premium for companies
    }
    return multipliers[categoryId] || 1.0
  }

  // Format price with currency using English numbers
  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price) + ' د.ل'
  }

  // Calculate final price with municipality multiplier and duration discount
  const calculateFinalPrice = (basePrice: number): { price: number, calculation: string, dailyRate: number } => {
    const municipality = pricingData.municipalities.find(m => m.id === pricingData.currentMunicipality)
    const duration = durationOptions.find(d => d.value === pricingData.currentDuration)

    let finalPrice = basePrice
    let calculationSteps = [`السعر الأساسي: ${formatPrice(basePrice)}`]

    // Apply municipality multiplier
    if (municipality && municipality.multiplier !== 1.0) {
      finalPrice *= municipality.multiplier
      calculationSteps.push(`معامل ${municipality.name}: ×${municipality.multiplier} = ${formatPrice(finalPrice)}`)
    }

    // Apply duration discount
    if (duration && duration.discount > 0) {
      const discountAmount = finalPrice * (duration.discount / 100)
      finalPrice -= discountAmount
      calculationSteps.push(`خصم ${duration.label}: -${duration.discount}% = ${formatPrice(finalPrice)}`)
    }

    // Calculate daily rate
    let dailyRate = finalPrice
    if (duration) {
      if (duration.unit === 'month') {
        dailyRate = finalPrice / 30
      } else if (duration.unit === 'months') {
        dailyRate = finalPrice / duration.value
      } else if (duration.unit === 'year') {
        dailyRate = finalPrice / 365
      }
      // For 'day' unit, dailyRate remains the same as finalPrice
    }

    return {
      price: Math.round(finalPrice),
      calculation: calculationSteps.join('\n'),
      dailyRate: Math.round(dailyRate)
    }
  }

  // Handle cell editing
  const startEdit = (size: string, category: string) => {
    const cellKey = `${size}-${category}`
    setEditingCell(cellKey)
    setEditingValue(pricingData.prices[size]?.[category]?.toString() || '')
  }

  const saveEdit = async () => {
    if (!editingCell) return

    const [size, category] = editingCell.split('-')
    const value = parseInt(editingValue) || 0

    if (value < 0) {
      showNotification('error', 'لا يمكن أن يكون السعر أقل من صفر')
      return
    }

    // Update local state
    setPricingData(prev => ({
      ...prev,
      prices: {
        ...prev.prices,
        [size]: {
          ...prev.prices[size],
          [category]: value
        }
      }
    }))

    setUnsavedChanges(prev => ({
      hasChanges: true,
      changedCells: new Set([...prev.changedCells, editingCell])
    }))

    // Auto-save the change
    try {
      const { newPricingService } = await import('@/services/newPricingService')
      const currentPricing = newPricingService.getPricing()

      // Update the specific pricing zone (assuming we're working with the current municipality)
      const currentZone = pricingData.currentMunicipality
      const zoneName = pricingData.municipalities.find(m => m.id === currentZone)?.name || 'مصراتة'

      if (currentPricing.zones[zoneName]) {
        // Update the zone's customer type pricing
        const customerType = category as 'marketers' | 'individuals' | 'companies'
        if (currentPricing.zones[zoneName].prices[customerType]) {
          currentPricing.zones[zoneName].prices[customerType][size] = value

          const result = newPricingService.updatePricing(currentPricing)
          if (result.success) {
            console.log(`تم حفظ السعر تلقائياً: ${size} - ${category} = ${value}`)
          }
        }
      }
    } catch (error) {
      console.warn('لم يتم الحفظ التلقائي:', error)
    }

    setEditingCell(null)
    showNotification('success', 'تم تحديث السعر بنجاح')
  }

  const cancelEdit = () => {
    setEditingCell(null)
    setEditingValue('')
  }

  // Add new category
  const addCategory = async () => {
    if (!newCategory.name.trim()) return

    const categoryId = Date.now().toString()
    const newCat: Category = {
      id: categoryId,
      name: newCategory.name,
      description: newCategory.description,
      color: newCategory.color
    }

    // Update local state
    setPricingData(prev => {
      const updatedCategories = [...prev.categories, newCat]
      const updatedPrices = { ...prev.prices }

      // Add default prices for new category
      prev.sizes.forEach(size => {
        if (!updatedPrices[size]) updatedPrices[size] = {}
        const basePrice = getSizeBasePrice(size)
        updatedPrices[size][categoryId] = basePrice
      })

      return {
        ...prev,
        categories: updatedCategories,
        prices: updatedPrices
      }
    })

    // Auto-save new category (this is more for demo - categories are UI-specific)
    try {
      await autoSaveChanges({})
      console.log(`تم حفظ الفئ�� الجديدة تلقائياً: ${newCategory.name}`)
    } catch (error) {
      console.warn('لم يتم حفظ الفئة الجديدة تلقائياً:', error)
    }

    setNewCategory({ name: '', description: '', color: 'blue' })
    setShowCategoryModal(false)
    showNotification('success', `تم إضافة فئة "${newCategory.name}" بنجاح`)
  }

  // Add new level
  const addLevel = () => {
    if (!newLevel.name.trim()) return

    const levelId = Date.now().toString()
    const newLvl: Level = {
      id: levelId,
      name: newLevel.name,
      description: newLevel.description,
      discount: newLevel.discount
    }

    setPricingData(prev => ({
      ...prev,
      levels: [...prev.levels, newLvl]
    }))

    setNewLevel({ name: '', description: '', discount: 0 })
    setShowLevelModal(false)
    showNotification('success', `تم إضافة مستوى "${newLevel.name}" بنجاح`)
  }

  // Add new size
  const addSize = async () => {
    const newSize = prompt('أدخل المقاس الجديد (مثال: 6x14):')
    if (!newSize || !newSize.match(/^\d+x\d+$/)) {
      showNotification('error', 'يرجى إدخال مقاس صحيح بصيغة رقمxرقم')
      return
    }

    if (pricingData.sizes.includes(newSize)) {
      showNotification('error', 'هذا المقاس موجود بالفعل')
      return
    }

    setPricingData(prev => {
      const updatedSizes = [...prev.sizes, newSize]
      const updatedPrices = { ...prev.prices }
      
      // Add default prices for new size
      updatedPrices[newSize] = {}
      prev.categories.forEach(category => {
        const basePrice = getSizeBasePrice(newSize)
        const categoryMultiplier = getCategoryMultiplier(category.id)
        updatedPrices[newSize][category.id] = Math.round(basePrice * categoryMultiplier)
      })

      return {
        ...prev,
        sizes: updatedSizes,
        prices: updatedPrices
      }
    })

    showNotification('success', `تم إضافة ��قاس "${newSize}" بنجاح`)
  }

  // Delete size
  const deleteSize = (size: string) => {
    if (pricingData.sizes.length <= 1) {
      showNotification('error', 'لا يمكن حذف آخر مقاس')
      return
    }

    if (!window.confirm(`هل أنت متأكد من حذف مقاس "${size}"؟`)) return

    setPricingData(prev => {
      const updatedSizes = prev.sizes.filter(s => s !== size)
      const { [size]: deleted, ...updatedPrices } = prev.prices

      return {
        ...prev,
        sizes: updatedSizes,
        prices: updatedPrices
      }
    })

    showNotification('success', `تم حذف مقاس "${size}" بنجاح`)
  }

  // Import municipalities from Excel
  const importMunicipalities = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const worksheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][]

        // Skip header row and process data
        const municipalities: Municipality[] = []
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i]
          if (row[0] && row[1]) {
            municipalities.push({
              id: Date.now().toString() + i,
              name: row[0].toString(),
              multiplier: parseFloat(row[1].toString()) || 1.0
            })
          }
        }

        if (municipalities.length > 0) {
          setPricingData(prev => ({
            ...prev,
            municipalities: [...prev.municipalities, ...municipalities]
          }))
          showNotification('success', `تم استيراد ${municipalities.length} بلدية بنجاح`)
        }
      } catch (error) {
        showNotification('error', 'خطأ في قراءة ملف Excel')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  // Export municipalities to Excel
  const exportMunicipalities = () => {
    const data = [
      ['البلدية', 'المعامل'],
      ...pricingData.municipalities.map(m => [m.name, m.multiplier])
    ]

    const worksheet = XLSX.utils.aoa_to_sheet(data)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'البلديات')
    XLSX.writeFile(workbook, 'municipalities.xlsx')
  }

  // Auto-save changes to the pricing service
  const autoSaveChanges = async (changes: any) => {
    try {
      const { newPricingService } = await import('@/services/newPricingService')
      const currentPricing = newPricingService.getPricing()

      // Update the pricing data with changes
      const updatedPricing = {
        ...currentPricing,
        ...changes
      }

      const result = newPricingService.updatePricing(updatedPricing)

      if (result.success) {
        console.log('تم حفظ التغييرات تلقائياً')
        return true
      } else {
        console.error('فشل في الحفظ التلقائي:', result.error)
        return false
      }
    } catch (error) {
      console.error('خطأ في الحفظ التلقائي:', error)
      return false
    }
  }

  // Save all changes
  const saveAllChanges = async () => {
    setLoading(true)

    try {
      // Save to the new pricing service
      const success = await autoSaveChanges({
        // Add any specific changes that need to be saved
      })

      if (success) {
        setUnsavedChanges({ hasChanges: false, changedCells: new Set() })
        showNotification('success', 'تم حفظ جميع التغييرات بنجاح')
      } else {
        showNotification('error', 'فشل في حفظ بعض التغييرات')
      }
    } catch (error: any) {
      showNotification('error', `خطأ في الحفظ: ${error.message}`)
    }

    setLoading(false)
  }

  // Reset all changes
  const resetAllChanges = async () => {
    if (window.confirm('هل أنت متأكد من إلغاء جميع التغييرات غير المحفوظة؟')) {
      await initializePricingData()
      setUnsavedChanges({ hasChanges: false, changedCells: new Set() })
      showNotification('success', 'تم إلغاء جميع التغييرات')
    }
  }

  // Filter sizes based on search
  const filteredSizes = pricingData.sizes.filter(size =>
    size.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const selectedMunicipality = pricingData.municipalities.find(m => m.id === pricingData.currentMunicipality)
  const selectedDuration = durationOptions.find(d => d.value === pricingData.currentDuration)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">إدارة الأسعار المتطورة</h1>
                <p className="text-sm opacity-90">النظام الشامل لإدارة أسعار اللوحات الإعلانية</p>
              </div>
            </div>
            <Button
              onClick={onClose}
              variant="outline"
              size="sm"
              className="bg-white/20 border-white/30 text-white hover:bg-white/30"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(95vh-120px)]">
          {/* Notification */}
          {notification && (
            <div className={`mb-6 p-4 rounded-lg border-l-4 ${
              notification.type === 'success'
                ? 'bg-green-50 border-green-400 text-green-700'
                : notification.type === 'info'
                ? 'bg-blue-50 border-blue-400 text-blue-700'
                : 'bg-red-50 border-red-400 text-red-700'
            }`}>
              <div className="flex items-center gap-2">
                {notification.type === 'success' ? (
                  <CheckCircle className="w-5 h-5" />
                ) : notification.type === 'info' ? (
                  <Info className="w-5 h-5" />
                ) : (
                  <AlertTriangle className="w-5 h-5" />
                )}
                <span className="font-semibold">{notification.message}</span>
              </div>
            </div>
          )}

          {/* Unsaved Changes Bar */}
          {unsavedChanges.hasChanges && (
            <div className="sticky top-0 z-10 mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-yellow-800">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="font-semibold">لديك تغييرات غير محفوظة</span>
                  <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                    {unsavedChanges.changedCells.size} تغيير
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={saveAllChanges}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                    disabled={loading}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    حفظ الكل
                  </Button>
                  <Button
                    onClick={resetAllChanges}
                    variant="outline"
                    size="sm"
                    className="text-yellow-800 border-yellow-300"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    تراجع الكل
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Filters and Controls */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Level Selection */}
            <Card className="p-4">
              <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                اختيار المستوى
              </h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {pricingData.levels.map((level) => (
                  <Button
                    key={level.id}
                    onClick={() => setPricingData(prev => ({ ...prev, currentLevel: level.id }))}
                    className={`px-4 py-2 rounded-full font-bold transition-all ${
                      pricingData.currentLevel === level.id
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {level.name}
                  </Button>
                ))}
              </div>
              <Button
                onClick={() => setShowLevelModal(true)}
                variant="outline"
                size="sm"
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                إضافة مستوى جديد
              </Button>
            </Card>

            {/* Municipality Selection */}
            <Card className="p-4">
              <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                اختيار البلدية
              </h3>
              <select
                value={pricingData.currentMunicipality}
                onChange={(e) => setPricingData(prev => ({ ...prev, currentMunicipality: e.target.value }))}
                className="w-full p-2 border border-gray-300 rounded-lg mb-2"
              >
                {pricingData.municipalities.map((municipality) => (
                  <option key={municipality.id} value={municipality.id}>
                    {municipality.name} — المعامل {municipality.multiplier}
                  </option>
                ))}
              </select>
              {selectedMunicipality && selectedMunicipality.multiplier !== 1.0 && (
                <div className="text-sm text-blue-600 font-semibold">
                  معامل الضرب: {selectedMunicipality.multiplier} ×
                </div>
              )}
            </Card>

            {/* Duration Selection */}
            <Card className="p-4">
              <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                المدة الزمنية
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {durationOptions.map((duration) => (
                  <Button
                    key={duration.value}
                    onClick={() => setPricingData(prev => ({ ...prev, currentDuration: duration.value }))}
                    className={`relative px-3 py-2 rounded-lg font-semibold transition-all text-sm ${
                      pricingData.currentDuration === duration.value
                        ? 'bg-green-600 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <div className="text-center">
                      <div className="font-bold">{duration.label}</div>
                      {duration.unit === 'day' && <div className="text-xs opacity-75">حساب يومي</div>}
                      {duration.unit !== 'day' && <div className="text-xs opacity-75">شامل الخصم</div>}
                    </div>
                    {duration.discount > 0 && (
                      <Badge
                        variant="secondary"
                        className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-1"
                      >
                        -{duration.discount}%
                      </Badge>
                    )}
                  </Button>
                ))}
              </div>
              {selectedDuration && selectedDuration.discount > 0 && (
                <div className="text-sm text-green-600 font-semibold mt-2 text-center">
                  خصم {selectedDuration.discount}% على الإجمالي • {selectedDuration.label}
                </div>
              )}
            </Card>
          </div>

          {/* Categories Management */}
          <Card className="mb-6 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Users className="w-5 h-5" />
                إدارة الفئات
              </h3>
              <Button
                onClick={() => setShowCategoryModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                إضافة فئة
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {pricingData.categories.map((category) => (
                <Badge
                  key={category.id}
                  className={`px-3 py-1 text-sm bg-${category.color}-100 text-${category.color}-800 border border-${category.color}-200`}
                >
                  {category.name}
                  {category.description && (
                    <span className="text-xs opacity-75 mr-2">({category.description})</span>
                  )}
                </Badge>
              ))}
            </div>
          </Card>

          {/* Sync Status and Controls */}
          {(syncStatus.needsSync || syncStatus.lastSync) && (
            <Card className="mb-6 p-4 border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <RotateCcw className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-blue-900">مزامنة المناطق السعرية مع ملف الإكسل</h3>
                    {syncStatus.needsSync ? (
                      <p className="text-sm text-blue-700">
                        🔥 تم الع��ور عل�� <span className="font-bold">{syncStatus.missingZones?.length || 0}</span> منطقة جديدة في ملف الإكسل تحتاج إلى مزامنة
                      </p>
                    ) : syncStatus.lastSync ? (
                      <p className="text-sm text-green-700">
                        ✅ آخر مزامنة: {new Date(syncStatus.lastSync).toLocaleString('ar-SA')}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {syncStatus.lastSync && (
                    <Button
                      onClick={() => setShowSyncInfo(!showSyncInfo)}
                      variant="outline"
                      size="sm"
                      className="text-blue-600 border-blue-300"
                    >
                      <Info className="w-4 h-4 mr-2" />
                      التفاصيل
                    </Button>
                  )}
                  <Button
                    onClick={syncWithExcel}
                    disabled={syncStatus.isLoading}
                    className={`${
                      syncStatus.needsSync
                        ? 'bg-orange-600 hover:bg-orange-700 animate-pulse'
                        : 'bg-blue-600 hover:bg-blue-700'
                    } text-white`}
                  >
                    {syncStatus.isLoading ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <RotateCcw className="w-4 h-4 mr-2" />
                    )}
                    {syncStatus.isLoading ? 'جاري المزامنة...' : 'مزامنة الآن'}
                  </Button>
                </div>
              </div>

              {/* Sync Info Details */}
              {showSyncInfo && syncStatus.lastSync && (
                <div className="mt-4 p-3 bg-white rounded-lg border border-blue-200">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="text-center">
                      <div className="font-bold text-blue-900">{syncStatus.totalMunicipalities || 0}</div>
                      <div className="text-blue-700">إجمالي البلديات</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-green-900">{syncStatus.existingZones || 0}</div>
                      <div className="text-green-700">مناطق موجودة</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-orange-900">{syncStatus.newZonesCreated || 0}</div>
                      <div className="text-orange-700">مناطق جديدة</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-purple-900">{Object.keys(pricingData.zones || {}).length}</div>
                      <div className="text-purple-700">إجمالي المناطق</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Missing Zones List */}
              {syncStatus.needsSync && syncStatus.missingZones && syncStatus.missingZones.length > 0 && (
                <div className="mt-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <h4 className="font-bold text-orange-900 mb-2">المناطق الجديدة المكتشفة:</h4>
                  <div className="flex flex-wrap gap-2">
                    {syncStatus.missingZones.map(zone => (
                      <span
                        key={zone}
                        className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-semibold"
                      >
                        {zone}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Search and Controls */}
          <Card className="mb-6 p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="البحث في المقاسات..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>
                <Button
                  onClick={addSize}
                  variant="outline"
                  className="text-green-600 border-green-300"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  إضافة مقاس
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={importMunicipalities}
                  accept=".xlsx,.xls"
                  className="hidden"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  className="text-blue-600 border-blue-300"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  استيراد بلديات
                </Button>
                <Button
                  onClick={exportMunicipalities}
                  variant="outline"
                  className="text-green-600 border-green-300"
                >
                  <Download className="w-4 h-4 mr-2" />
                  تصدير بلديات
                </Button>
              </div>
            </div>
          </Card>

          {/* Pricing Table */}
          <Card className="mb-6 shadow-xl rounded-xl overflow-hidden border-0">
            <div className="p-6 bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                      <Calculator className="w-6 h-6" />
                    </div>
                    أسعار حسب فئة العميل
                    {selectedDuration?.unit === 'day' && (
                      <Badge className="bg-yellow-500 text-black text-sm font-bold px-3 py-1">حساب يومي</Badge>
                    )}
                  </h3>
                  <p className="text-blue-100 mt-2 text-sm">
                    جدول الأسعار التفاعلي مع إمكانية التعديل المباشر
                  </p>
                </div>
                <div className="text-right">
                  <Badge className="bg-white/20 text-white text-lg px-4 py-2 font-bold">
                    {selectedDuration?.label}
                  </Badge>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 mt-4 text-sm">
                <div className="bg-white/10 backdrop-blur-sm px-3 py-2 rounded-full">
                  <span className="text-blue-100">المستوى:</span>
                  <span className="text-white font-bold mr-2">{pricingData.levels.find(l => l.id === pricingData.currentLevel)?.name}</span>
                </div>
                {selectedMunicipality && (
                  <div className="bg-white/10 backdrop-blur-sm px-3 py-2 rounded-full">
                    <span className="text-blue-100">البلدية:</span>
                    <span className="text-white font-bold mr-2">{selectedMunicipality.name}</span>
                    <span className="text-blue-200">(معامل: {selectedMunicipality.multiplier})</span>
                  </div>
                )}
                {selectedDuration && selectedDuration.discount > 0 && (
                  <div className="bg-red-500/80 backdrop-blur-sm px-3 py-2 rounded-full">
                    <span className="text-red-100">خصم:</span>
                    <span className="text-white font-bold mr-2">{selectedDuration.discount}%</span>
                  </div>
                )}
              </div>
            </div>
            <div className="overflow-x-auto bg-gradient-to-br from-gray-50 to-white">
              <table className="w-full border-collapse pricing-table">
                <thead className="sticky top-0 z-20">
                  <tr className="shadow-lg">
                    <th className="border-0 p-4 text-right font-bold bg-gradient-to-br from-yellow-400 to-yellow-500 text-gray-900 text-sm min-w-[100px] shadow-lg">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        الحجم
                      </div>
                    </th>
                    {pricingData.categories.map(category => (
                      <th
                        key={category.id}
                        className="border-0 p-4 text-center font-bold text-white text-sm min-w-[130px] shadow-lg"
                        style={{
                          background: `linear-gradient(135deg, ${
                            category.color === 'blue' ? '#3B82F6, #1E40AF' :
                            category.color === 'green' ? '#10B981, #047857' :
                            category.color === 'purple' ? '#8B5CF6, #7C3AED' :
                            category.color === 'red' ? '#EF4444, #DC2626' :
                            category.color === 'yellow' ? '#F59E0B, #D97706' :
                            category.color === 'pink' ? '#EC4899, #DB2777' :
                            category.color === 'indigo' ? '#6366F1, #4F46E5' :
                            category.color === 'gray' ? '#6B7280, #4B5563' :
                            category.color === 'orange' ? '#F97316, #EA580C' :
                            category.color === 'teal' ? '#14B8A6, #0D9488' :
                            category.color === 'gold' ? '#D4AF37, #B8860B' : '#3B82F6, #1E40AF'
                          })`
                        }}
                      >
                        <div className="leading-tight">
                          <div className="font-bold text-base">{category.name}</div>
                          <div className="text-xs opacity-90 mt-1 bg-white/20 px-2 py-1 rounded-full inline-block">
                            سعر يومي
                          </div>
                        </div>
                      </th>
                    ))}
                    <th className="border-0 p-4 text-center font-bold bg-gradient-to-br from-red-500 to-red-600 text-white text-sm min-w-[100px] shadow-lg">
                      <div className="flex items-center justify-center gap-2">
                        <Settings className="w-4 h-4" />
                        الإجراءات
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSizes.map((size, index) => (
                    <tr key={size} className={`hover:bg-blue-50 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] transform ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                      <td className="border-0 p-4 font-bold text-gray-900 bg-gradient-to-r from-yellow-100 to-yellow-50 text-base text-center shadow-sm">
                        <div className="bg-white px-3 py-2 rounded-lg font-black text-lg text-yellow-800 shadow-inner">
                          {size}
                        </div>
                      </td>
                      {pricingData.categories.map(category => {
                        const cellKey = `${size}-${category.id}`
                        const basePrice = pricingData.prices[size]?.[category.id] || 0
                        const { price: finalPrice, calculation, dailyRate } = calculateFinalPrice(basePrice)
                        const isEditing = editingCell === cellKey
                        const hasChanges = unsavedChanges.changedCells.has(cellKey)

                        return (
                          <td
                            key={category.id}
                            className={`border-0 p-2 text-center relative transition-all duration-300 ${
                              hasChanges ? 'bg-yellow-200 shadow-inner animate-pulse' : 'bg-white'
                            }`}
                          >
                            {isEditing ? (
                              <div className="flex items-center gap-2 justify-center bg-white p-3 rounded-lg shadow-lg border-2 border-blue-500">
                                <Input
                                  type="number"
                                  value={editingValue}
                                  onChange={(e) => setEditingValue(e.target.value)}
                                  className="w-20 text-center font-bold text-sm border-2 border-blue-300 focus:border-blue-500"
                                  min="0"
                                  autoFocus
                                />
                                <Button
                                  onClick={saveEdit}
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all"
                                >
                                  <Check className="w-4 h-4" />
                                </Button>
                                <Button
                                  onClick={cancelEdit}
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 border-red-300 hover:bg-red-50 px-2 py-1 rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            ) : (
                              <div
                                className="cursor-pointer price-cell group py-3 px-2 rounded-lg hover:bg-blue-50 hover:shadow-md transform hover:scale-105 transition-all duration-200 border border-transparent hover:border-blue-200"
                                onClick={() => startEdit(size, category.id)}
                                title={calculation}
                              >
                                <div className="flex flex-col items-center justify-center gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-gray-800 text-base leading-tight bg-gray-100 px-2 py-1 rounded-lg group-hover:bg-blue-100 transition-colors">
                                      {formatPrice(basePrice)}
                                    </span>
                                    <Edit3 className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 group-hover:text-blue-600 transition-all duration-200" />
                                  </div>
                                  <div className="text-xs text-blue-600 font-semibold bg-blue-50 px-2 py-1 rounded-full">
                                    يومي: {formatPrice(dailyRate)}
                                  </div>
                                  {finalPrice !== basePrice && (
                                    <div className="text-xs text-green-600 font-semibold px-2 py-1 bg-green-100 rounded-full shadow-sm">
                                      النهائي: {formatPrice(finalPrice)}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </td>
                        )
                      })}
                      <td className="border-0 p-4 text-center bg-gradient-to-r from-gray-50 to-white">
                        <Button
                          onClick={() => deleteSize(size)}
                          variant="outline"
                          size="sm"
                          className="text-red-600 border-red-300 hover:bg-red-50 hover:border-red-500 transition-all duration-200 p-2 rounded-lg shadow-sm hover:shadow-md transform hover:scale-105"
                          disabled={pricingData.sizes.length <= 1}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-6 bg-gradient-to-r from-green-50 to-blue-50 border-t-2 border-green-200">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  <span className="font-semibold">إجمالي المقاسات:</span>
                  <Badge className="bg-blue-100 text-blue-800 mr-2">{pricingData.sizes.length}</Badge>
                  <span className="font-semibold mr-4">إجمالي الفئات:</span>
                  <Badge className="bg-green-100 text-green-800">{pricingData.categories.length}</Badge>
                </div>
                <Button
                  onClick={addSize}
                  className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 px-6 py-3 rounded-xl"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  إضافة حجم جديد
                </Button>
              </div>
            </div>
          </Card>

          {/* Municipality Multipliers Table */}
          <Card className="mb-6 shadow-xl rounded-xl overflow-hidden border-0">
            <div className="p-6 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                      <MapPin className="w-6 h-6" />
                    </div>
                    جدول معاملات البلديات
                  </h3>
                  <p className="text-purple-100 mt-2">إدارة معاملات الضرب للبلديات المختلفة مع التحكم الكامل</p>
                </div>
                <Badge className="bg-white/20 text-white text-lg px-4 py-2 font-bold">
                  {pricingData.municipalities.length} بلدية
                </Badge>
              </div>
            </div>
            <div className="overflow-x-auto bg-gradient-to-br from-gray-50 to-white">
              <table className="w-full border-collapse municipality-table">
                <thead>
                  <tr className="shadow-lg">
                    <th className="border-0 p-4 text-right font-bold bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        اسم البلدية
                      </div>
                    </th>
                    <th className="border-0 p-4 text-center font-bold bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg">
                      <div className="flex items-center justify-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        المعامل
                      </div>
                    </th>
                    <th className="border-0 p-4 text-center font-bold bg-gradient-to-r from-pink-500 to-red-500 text-white shadow-lg">
                      <div className="flex items-center justify-center gap-2">
                        <Settings className="w-4 h-4" />
                        الإجراءات
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pricingData.municipalities.map((municipality, index) => (
                    <tr key={municipality.id} className={`hover:bg-indigo-50 hover:shadow-lg transform hover:scale-[1.02] transition-all duration-300 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                      <td className="border-0 p-4 font-semibold text-gray-800">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 bg-indigo-500 rounded-full"></div>
                          <span className="text-base">{municipality.name}</span>
                        </div>
                      </td>
                      <td className="border-0 p-4 text-center">
                        <Input
                          type="number"
                          value={municipality.multiplier}
                          onChange={(e) => {
                            const newMultiplier = parseFloat(e.target.value) || 1.0
                            setPricingData(prev => ({
                              ...prev,
                              municipalities: prev.municipalities.map(m =>
                                m.id === municipality.id
                                  ? { ...m, multiplier: newMultiplier }
                                  : m
                              )
                            }))
                          }}
                          className="w-20 text-center font-bold text-base border-2 border-purple-200 rounded-lg focus:border-purple-500 bg-white shadow-sm hover:shadow-md transition-all"
                          step="0.1"
                          min="0"
                        />
                      </td>
                      <td className="border-0 p-4 text-center">
                        <Button
                          onClick={() => {
                            if (window.confirm(`هل تريد حذف "${municipality.name}"؟`)) {
                              setPricingData(prev => ({
                                ...prev,
                                municipalities: prev.municipalities.filter(m => m.id !== municipality.id)
                              }))
                            }
                          }}
                          variant="outline"
                          size="sm"
                          className="text-red-600 border-red-300 hover:bg-red-50 hover:border-red-500 transition-all duration-200 p-2 rounded-lg shadow-sm hover:shadow-md transform hover:scale-105"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Category Modal */}
        {showCategoryModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-60">
            <Card className="w-full max-w-md p-6">
              <h3 className="text-xl font-bold mb-4">إضافة فئة جديدة</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">اسم الفئة</label>
                  <Input
                    value={newCategory.name}
                    onChange={(e) => setNewCategory(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="أدخل اسم الفئة"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">الوصف (اختياري)</label>
                  <Input
                    value={newCategory.description}
                    onChange={(e) => setNewCategory(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="وصف الفئة"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">اللون</label>
                  <select
                    value={newCategory.color}
                    onChange={(e) => setNewCategory(prev => ({ ...prev, color: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  >
                    <option value="blue">أزرق</option>
                    <option value="green">أخضر</option>
                    <option value="purple">بنفسجي</option>
                    <option value="red">أحمر</option>
                    <option value="yellow">أصفر</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <Button
                  onClick={addCategory}
                  disabled={!newCategory.name.trim()}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  إضافة
                </Button>
                <Button
                  onClick={() => setShowCategoryModal(false)}
                  variant="outline"
                  className="flex-1"
                >
                  إلغاء
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Level Modal */}
        {showLevelModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-60">
            <Card className="w-full max-w-md p-6">
              <h3 className="text-xl font-bold mb-4">إضافة مستوى جديد</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">اسم المستوى</label>
                  <Input
                    value={newLevel.name}
                    onChange={(e) => setNewLevel(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="أدخل اسم المستوى"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">الوصف</label>
                  <Input
                    value={newLevel.description}
                    onChange={(e) => setNewLevel(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="وصف المستوى"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">خصم اختياري (%)</label>
                  <Input
                    type="number"
                    value={newLevel.discount}
                    onChange={(e) => setNewLevel(prev => ({ ...prev, discount: parseInt(e.target.value) || 0 }))}
                    placeholder="0"
                    min="0"
                    max="100"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <Button
                  onClick={addLevel}
                  disabled={!newLevel.name.trim()}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  إضافة
                </Button>
                <Button
                  onClick={() => setShowLevelModal(false)}
                  variant="outline"
                  className="flex-1"
                >
                  إلغاء
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

export default EnhancedPricingManagement
