export type SegmentTemplateType = {
  duration: string
  timescale: string
  media: string
  initialization: string
  startNumber: string
}

export class DashSegmentFetcher {
  private segmentTemplate: SegmentTemplateType
  private currentRepresentationId: string
  private baseURL: string

  constructor(segmentTemplate: SegmentTemplateType, currentRepresentationId: string, baseURL: string) {
    this.segmentTemplate = segmentTemplate
    this.currentRepresentationId = currentRepresentationId
    this.baseURL = baseURL
  }

  public async loadInitSegment() {
    const segmentUrl = this.getSegmentUrl(this.segmentTemplate.initialization)
    const response = await fetch(this.baseURL + '/' + segmentUrl)
    const data = await response.arrayBuffer()
    return data
  }

  public async loadSegment(segmentNumber: number) {
    const segmentUrl = this.getSegmentUrl(this.segmentTemplate.media, segmentNumber)
    const response = await fetch(this.baseURL + '/' + segmentUrl)
    const data = await response.arrayBuffer()
    return data
  }

  public getSegmentUrl(url: string, segmentNumber: number = 0) {
    if (!this.currentRepresentationId) {
      throw new Error('No current representation id set')
    }

    return url
      .replace(/\$RepresentationID\$/g, this.currentRepresentationId)
      .replace(/\$Number\$/g, segmentNumber.toString())
  }

  public getSegmentDurationSeconds() {
    return parseFloat(this.segmentTemplate.duration) / parseFloat(this.segmentTemplate.timescale)
  }
}
