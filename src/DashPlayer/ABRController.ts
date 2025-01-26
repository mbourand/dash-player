type SegmentFetchMetrics = {
  segmentDuration: number
  fetchDuration: number
}

export class ABRController {
  private fetchHistory: SegmentFetchMetrics[] = []
  private fetchHistorySize: number

  constructor(historySize: number) {
    this.fetchHistorySize = historySize
  }

  public getAverageFetchTimePerSecond() {
    const fetchTimePerSecond = this.fetchHistory.map((fetch) => fetch.fetchDuration / fetch.segmentDuration)
    return fetchTimePerSecond.reduce((a, b) => a + b, 0) / fetchTimePerSecond.length
  }

  public addFetch(metrics: SegmentFetchMetrics) {
    this.fetchHistory.push(metrics)
    if (this.fetchHistory.length > this.fetchHistorySize) {
      this.fetchHistory.shift()
    }
  }

  public getFetchHistorySize() {
    return this.fetchHistorySize
  }

  public setFetchHistorySize(size: number) {
    this.fetchHistorySize = size
  }

  public reset() {
    this.fetchHistory = []
  }
}
