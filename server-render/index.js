import { h } from '../src/h'
import { encodeEntities, styleObjToCss, indent, getChildren } from './util'
import { resetCursor } from '../src/hooks'
const VOID_ELEMENTS = /^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/
function attributeHook (name, value, isComponent) {
  let type = typeof value
  if (name === 'dangerouslySetInnerHTML') return false
  if (value == null || type === 'function') return ''

  if (
    !isComponent &&
    (value === false ||
      ((name === 'class' || name === 'style') && value === ''))
  ) { return '' }

  let indentChar = '\t'
  if (type !== 'string') {
    return indent(`\n${name}={${value}}`, indentChar)
  }
  return `\n${indentChar}${name}="${encodeEntities(value)}"`
}
export let currentVnode
export default async function renderToString (vnode, isSvgMode, selectValue) {
  console.log(vnode)
  if (vnode == null || typeof vnode === 'boolean') return ''
  let nodeName = vnode.type

  let props = vnode.props

  let isComponent = false
  resetCursor()
  if (nodeName === 'text' && props.nodeValue) {
    return encodeEntities(props.nodeValue)
  }
  if (typeof nodeName === 'function') {
    isComponent = true
    currentVnode = vnode
    let tempVnode = nodeName.call(vnode, props)
    if (vnode.hooks.effect.length) {
      resetCursor()
      const effect = vnode.hooks.effect
      const cleanups = await Promise.all(
        effect.map(e => Promise.resolve(e[0]()))
      )
      vnode.hooks.effect = []
      tempVnode = nodeName.call(vnode, props)
      cleanups.filter(c => !!c).map(c => c())
    }
    delete vnode.hooks
    currentVnode = null
    return await renderToString(tempVnode, isSvgMode, selectValue)
  }
  let s = ''

  let html
  if (props) {
    let attrs = Object.keys(props)
    for (let i = 0; i < attrs.length; i++) {
      let name = attrs[i]

      let v = props[name]
      if (name === 'children') continue

      if (name.match(/[\s\n\\/='"\0<>]/)) continue

      if (name === 'key' || name === 'ref') continue

      if (name === 'className') {
        name = 'class'
      } else if (isSvgMode && name.match(/^xlink:?./)) {
        name = name.toLowerCase().replace(/^xlink:?/, 'xlink:')
      }

      if (name === 'style' && v && typeof v === 'object') {
        v = styleObjToCss(v)
      }

      let hooked = attributeHook(name, v, isComponent)
      if (hooked || hooked === '') {
        s += hooked
        continue
      }

      if (name === 'dangerouslySetInnerHTML') {
        html = v && v.__html
      } else if ((v || v === 0 || v === '') && typeof v !== 'function') {
        if (v === true || v === '') {
          v = name
          s += ' ' + name
          continue
        }

        if (name === 'value') {
          if (nodeName === 'select') {
            selectValue = v
            continue
          } else if (nodeName === 'option' && selectValue == v) {
            s += ` selected`
          }
        }
        s += ` ${name}="${encodeEntities(v)}"`
      }
    }
  }
  s = `<${nodeName}${s}>`
  if (String(nodeName).match(/[\s\n\\/='"\0<>]/)) throw s
  let isVoid = String(nodeName).match(VOID_ELEMENTS)
  if (isVoid) s = s.replace(/>$/, ' />')
  let pieces = []

  let children
  if (html) {
    s += html
  } else if (props && getChildren((children = []), props.children).length) {
    for (let i = 0; i < children.length; i++) {
      let child = children[i]
      if (child != null && child !== false) {
        let childSvgMode =
            nodeName === 'svg'
              ? true
              : nodeName === 'foreignObject'
                ? false
                : isSvgMode

        let ret = await renderToString(child, childSvgMode, selectValue)
        if (ret) {
          pieces.push(ret)
        }
      }
    }
  }
  if (pieces.length) {
    s += pieces.join('')
  }

  if (!isVoid) {
    s += `</${nodeName}>`
  }

  return s
}