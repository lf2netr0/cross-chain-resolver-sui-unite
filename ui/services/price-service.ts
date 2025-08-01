// Types for price data
export interface PriceDataPoint {
  timestamp: number
  price: number
}

export interface TokenPairPriceData {
  pairId: string
  baseToken: string
  quoteToken: string
  data: PriceDataPoint[]
}

// Time periods for chart display
export type TimePeriod = "24h" | "7d" | "30d" | "90d" | "1y"

// Generate realistic looking price data with some volatility
const generatePriceData = (
  basePrice: number,
  volatility: number,
  count: number,
  interval: number,
): PriceDataPoint[] => {
  const now = Date.now()
  const data: PriceDataPoint[] = []

  let currentPrice = basePrice

  for (let i = count - 1; i >= 0; i--) {
    // Random walk with drift
    const change = (Math.random() - 0.5) * volatility * currentPrice
    currentPrice = Math.max(0.01, currentPrice + change)

    data.push({
      timestamp: now - i * interval,
      price: currentPrice,
    })
  }

  return data
}

// Cache for price data
const priceDataCache = new Map<string, Map<TimePeriod, TokenPairPriceData>>()

// Get price data for a token pair
export const getPriceData = (
  baseTokenId: string,
  quoteTokenId: string,
  period: TimePeriod = "24h",
): TokenPairPriceData => {
  const pairId = `${baseTokenId}-${quoteTokenId}`

  // Check if we have cached data
  if (!priceDataCache.has(pairId)) {
    priceDataCache.set(pairId, new Map())
  }

  const pairCache = priceDataCache.get(pairId)!

  // Return cached data if available
  if (pairCache.has(period)) {
    return pairCache.get(period)!
  }

  // Generate data based on the time period
  let dataPoints: number
  let interval: number
  let basePrice: number
  let volatility: number

  // Set parameters based on the token pair
  if (baseTokenId === "ethereum" && quoteTokenId === "usd-coin") {
    basePrice = 3500
    volatility = 0.01
  } else if (baseTokenId === "bitcoin" && quoteTokenId === "usd-coin") {
    basePrice = 65000
    volatility = 0.008
  } else if (baseTokenId === "MoveB" && quoteTokenId === "usd-coin") {
    basePrice = 2.5
    volatility = 0.02
  } else {
    // Default values
    basePrice = 100
    volatility = 0.015
  }

  // Set data points and interval based on period
  switch (period) {
    case "24h":
      dataPoints = 24
      interval = 60 * 60 * 1000 // 1 hour
      break
    case "7d":
      dataPoints = 7 * 24
      interval = 60 * 60 * 1000 // 1 hour
      break
    case "30d":
      dataPoints = 30
      interval = 24 * 60 * 60 * 1000 // 1 day
      break
    case "90d":
      dataPoints = 90
      interval = 24 * 60 * 60 * 1000 // 1 day
      break
    case "1y":
      dataPoints = 365
      interval = 24 * 60 * 60 * 1000 // 1 day
      break
    default:
      dataPoints = 24
      interval = 60 * 60 * 1000 // 1 hour
  }

  // Generate the price data
  const data = generatePriceData(basePrice, volatility, dataPoints, interval)

  // Create the price data object
  const priceData: TokenPairPriceData = {
    pairId,
    baseToken: baseTokenId,
    quoteToken: quoteTokenId,
    data,
  }

  // Cache the data
  pairCache.set(period, priceData)

  return priceData
}

// Format timestamp for display
export const formatTimestamp = (timestamp: number, period: TimePeriod): string => {
  const date = new Date(timestamp)

  switch (period) {
    case "24h":
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    case "7d":
      return date.toLocaleDateString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })
    case "30d":
    case "90d":
      return date.toLocaleDateString([], { month: "short", day: "numeric" })
    case "1y":
      return date.toLocaleDateString([], { month: "short", year: "2-digit" })
    default:
      return date.toLocaleString()
  }
}

// Calculate price change percentage
export const calculatePriceChange = (data: PriceDataPoint[]): number => {
  if (data.length < 2) return 0

  const firstPrice = data[0].price
  const lastPrice = data[data.length - 1].price

  return ((lastPrice - firstPrice) / firstPrice) * 100
}
