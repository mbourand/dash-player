import { DashSegmentFetcher } from './DashSegmentFetcher'
import { EventManager, EventType } from './EventManager'

export class DashBuffer {
  private sourceBuffer: SourceBuffer
  private segmentFetchDelay: number = 20
  private offsetSegmentNumber: number = 0
  private startSegmentNumber: number = 0
  private videoElement: HTMLVideoElement
  private dashSegmentFetcher: DashSegmentFetcher

  private _isFetchingSegment: boolean = false

  private eventManager = new EventManager()

  constructor(videoElement: HTMLVideoElement, sourceBuffer: SourceBuffer, dashSegmentFetcher: DashSegmentFetcher) {
    this.sourceBuffer = sourceBuffer
    this.videoElement = videoElement
    this.dashSegmentFetcher = dashSegmentFetcher
  }

  public addEventListener(event: EventType, listener: Function) {
    this.eventManager.addEventListener(event, listener)
  }

  public removeEventListener(event: EventType, listener: Function) {
    this.eventManager.removeEventListener(event, listener)
  }

  private getLastSegmentNumber() {
    return (
      this.startSegmentNumber +
      (Math.ceil(this.videoElement.duration / this.dashSegmentFetcher.getSegmentDurationSeconds()) - 1)
    )
  }

  public getCurrentSegmentNumber() {
    return this.offsetSegmentNumber + this.startSegmentNumber
  }

  public async init() {
    this.sourceBuffer.appendBuffer(await this.dashSegmentFetcher.loadInitSegment())
    this.sourceBuffer.addEventListener('updateend', () => {
      if (this.hasBufferReachedEnd()) {
        this.eventManager.emit(EventType.BufferReachedEnd)
      }
    })
  }

  public setStartSegmentNumber(segmentNumber: number) {
    this.startSegmentNumber = segmentNumber
  }

  public setSegmentFetchDelay(delay: number) {
    this.segmentFetchDelay = delay
  }

  public hasBufferReachedEnd() {
    return this.getCurrentSegmentNumber() > this.getLastSegmentNumber()
  }

  public shouldFetchNextSegment() {
    if (this._isFetchingSegment || this.hasBufferReachedEnd()) {
      return false
    }

    const { buffered, currentTime } = this.videoElement
    if (buffered == null || currentTime == null) {
      return false
    }

    const end = buffered.length > 0 ? buffered.end(buffered.length - 1) : Number.NEGATIVE_INFINITY

    return currentTime + this.segmentFetchDelay >= end
  }

  public async updateBuffer() {
    if (this.shouldFetchNextSegment()) {
      await this._appendNextSegment()
    }
  }

  public async seek(time: number) {
    this.sourceBuffer.abort()
    this.offsetSegmentNumber = Math.floor(time / this.dashSegmentFetcher.getSegmentDurationSeconds())
  }

  private async _appendNextSegment() {
    try {
      this._isFetchingSegment = true
      const nextSegment = await this.dashSegmentFetcher.loadSegment(this.getCurrentSegmentNumber())
      this.offsetSegmentNumber++
      this.sourceBuffer.appendBuffer(nextSegment)
    } catch (e) {
      console.error('Error fetching segment', e)
    } finally {
      this._isFetchingSegment = false
    }
  }
}
