import {dom, library, text} from '@fortawesome/fontawesome-svg-core'
import { FormElement } from '../Types'
import { FormElementBase } from './FormElementBase'
import { debounce } from '../Helpers'
import { faTimes, faPencilAlt, faCheck } from '@fortawesome/free-solid-svg-icons'

dom.watch()
library.add(faTimes, faPencilAlt, faCheck)

export class Reference extends FormElementBase implements FormElement {

  static type: string = 'reference'

  async init(): Promise<void> {
    await super.init();

    this.addEventListener('keyup', debounce(async (event: any) => {
      const value = event.detail.originalEvent.target.value
      if (value.substr(0, 4) !== 'http') {
        this.searchSuggestions = []
        this.field.autoCompleteQuery ? await this.sparqlQuery(value) : await this.dbpediaSuggestions(value)
        this.render()
      }
    }, 400))

    this.form.addEventListener('language-change', () => {
      this.updateMetas().then(() => this.render())
    })

    this.addEventListener('change', event => {
      this.updateMetas().then(() => this.render())
    })

    this.updateMetas().then(() => this.render())

    // if there is an autocomplete query and the query does not contain the SEARCH_TERM token.
    if (typeof this.field.autoCompleteQuery === 'string' && !this.field.autoCompleteQuery.includes('SEARCH_TERM')) {
      await this.sparqlQuery()
    }
  }

  /**
   * This template has a couple of states:
   *
   * - Showing default search suggestions
   * - Searching
   * - Empty state
   *
   * @param index
   * @param value
   */
  async templateItem (index, value) {
    const textValue = value?.['@id'] ?? ''
    const meta = this.metas.get(textValue)

    return meta && !this.expanded.get(index) ? this.html`
      ${await this.templateReferenceLabel(meta)}
      <button class="button" onclick="${() => { this.expanded.set(index, true); this.render() }}">
        <i class="fas fa-pencil-alt"></i>
      </button>
    ` : this.html`
      ${await super.templateItem(index, textValue)}
      <button class="button" onclick="${() => { this.expanded.set(index, false); this.render() }}">
        <i class="fas fa-check"></i>
      </button>
      ${this.searchSuggestions.length ? this.html`
      <ul classy:referencePreviewSearchSuggestions="search-suggestions">
        ${this.searchSuggestions.map(suggestion => this.html`<li onclick="${async () => {
          await this.selectSuggestion(suggestion.uri, index); this.render()
        }}">${suggestion.label}</li>`)}
      </ul>
      ` : ''}
    `
  }

}
