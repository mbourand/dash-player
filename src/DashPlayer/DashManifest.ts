import xmljs from 'xml-js'

export class DashManifest {
  constructor() {}

  public static fromXML(manifestContent: string): DashManifest {
    const contentStr = xmljs.xml2json(manifestContent, { compact: true })
    const content = JSON.parse(contentStr)
    console.log(content)
    return content
  }
}
