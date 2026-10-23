import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isStudioPreviewFrame } from '../src/studio-preview.ts'

describe('isStudioPreviewFrame (the bridge loads only in the real Studio preview)', () => {
  it('the actual preview host, framed', () => {
    assert.equal(isStudioPreviewFrame({ framed: true, ownHostname: 'i06ajohx9kwdf8gtsrbh4.preview.studio.arc.io' }), true)
  })
  it('a Studio parent frame', () => {
    assert.equal(isStudioPreviewFrame({ framed: true, ownHostname: 'localhost', ancestorOrigin: 'https://studio.arc.io' }), true)
    assert.equal(isStudioPreviewFrame({ framed: true, ownHostname: 'localhost', referrer: 'https://app.studio.arc.io/p/1' }), true)
  })
  it('never when not framed, even on the preview host', () => {
    assert.equal(isStudioPreviewFrame({ framed: false, ownHostname: 'x.preview.studio.arc.io' }), false)
    assert.equal(isStudioPreviewFrame({ framed: false, ownHostname: 'localhost', ancestorOrigin: 'https://studio.arc.io' }), false)
  })
  it('never for other hosts or look-alike parents', () => {
    for (const parent of ['https://evil.example', 'https://studio.arc.io.evil.example', 'https://notstudio.arc.io', 'https://studioXarc.io', 'not a url']) {
      assert.equal(isStudioPreviewFrame({ framed: true, ownHostname: 'localhost', ancestorOrigin: parent }), false, parent)
    }
    assert.equal(isStudioPreviewFrame({ framed: true, ownHostname: 'splitreceipt.axiqo.xyz' }), false)
    assert.equal(isStudioPreviewFrame({ framed: true, ownHostname: 'preview.studio.arc.io.evil.example' }), false)
  })
  it('a framed public site with no Studio ancestry gets nothing', () => {
    assert.equal(isStudioPreviewFrame({ framed: true, ownHostname: 'splitreceipt.axiqo.xyz', ancestorOrigin: null, referrer: null }), false)
  })
})
