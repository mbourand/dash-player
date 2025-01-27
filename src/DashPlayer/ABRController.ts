type SegmentFetchMetrics = {
  segmentDuration: number
  segmentBandwidth: number
  fetchDuration: number
}

export class ABRController {
  private fetchHistory: SegmentFetchMetrics[] = []
  private fetchHistorySize: number

  constructor(historySize: number) {
    this.fetchHistorySize = historySize
  }

  public getAverageBandwidth() {
    const totalNetworkBandwidth = this.fetchHistory.reduce(
      (total, fetch) => total + (fetch.segmentDuration * fetch.segmentBandwidth) / fetch.fetchDuration,
      0
    )
    return totalNetworkBandwidth / this.fetchHistory.length
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
