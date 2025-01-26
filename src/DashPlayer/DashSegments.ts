export class DashSegments {
  private segments: any[]

  constructor(segments: any[]) {
    this.segments = segments
  }

  public async loadInitSegment() {
    const response = await fetch(this.segments[0].map.resolvedUri)
    return await response.arrayBuffer()
  }

  public async loadSegment(segmentIndex: number) {
    const response = await fetch(this.getSegment(segmentIndex).resolvedUri)
    const data = await response.arrayBuffer()
    return data
  }

  public getSegmentCount() {
    return this.segments.length
  }

  public getSegmentAt(time: number) {
    const segmentIndex = this.getSegmentIndexAt(time)
    return this.getSegment(segmentIndex)
  }

  public getSegmentIndexAt(time: number) {
    let segmentIndex = 0

    for (let i = 0; i < this.segments.length; i++) {
      if (this.segments[i].presentationTime >= time) break
      segmentIndex = i
    }

    return segmentIndex
  }

  public getSegment(segmentIndex: number) {
    return this.segments[segmentIndex]
  }
}
