import { Language } from './LanguageService'
import { FieldDefinition } from './Types'
import {lastPart} from "./helpers/lastPart";

/**
 * This class sits between a field and the RDF JSON ld values.
 * All mutations to the data happen here.
 */
export class FieldValues {

  public jsonLdValueType = 'value'
  public bindingValues = new Map<string, any>()
  public bindings: Array<any> = []
  public additionalBindings: Array<any>
  public defaultBinding: string
  private innerBinding: string
  public Field: FieldDefinition
  private formOntology: {}
  private isList: boolean = false
  private isGroup: boolean = false

  /**
   *
   * @param parentValues
   * @param binding
   */
  constructor (field, parentValues, formOntology) {
    this.Field = field
    this.formOntology = formOntology

    // Goes through all the fields properties, check which items have bindings.
    for (const [fieldProperty, propertySetting] of Object.entries(this.Field)) {
      const fieldMetaProperties = this.formOntology['@graph'].find(predicate => predicate?.['@id'] === 'form:' + fieldProperty)
      if (fieldMetaProperties && fieldMetaProperties['form:isBindingProperty'] && Array.isArray(propertySetting)) {
        this.bindings.push(...propertySetting)
      }
    }

    // This initiates the values, it noramlizes the values into a common format.
    if (this.bindings.length > 1 || this.innerBinding) {
      this.initList(parentValues)
    } 
    else if (this.Field.fieldWidget === 'group') {
      this.initGroup(parentValues)
    }
    else {
      this.initDefault(parentValues)
    }    

    Language.addEventListener('language.removed', (event: CustomEvent) => {
      const removedLanguage = event.detail

      if (this.hasTranslations) {
        for (const binding of this.bindings) {
          let values = this.getAllFromBinding(binding)
          const index = values.find(value => value?.['@language'] === removedLanguage)
          if (index !== null) values.splice(index, 1)
        }  
      }
    })
  }

  initGroup (parentValues) {
    this.isGroup = true
    this.defaultBinding = this.bindings[0]
    const values = parentValues[this.defaultBinding]?.[0]?.['@list'] ?? parentValues[this.defaultBinding]
    this.bindingValues.set(lastPart(this.defaultBinding), values)
  }

  initList (parentValues) {
    this.isList = true
    this.defaultBinding = this.bindings[0]

    // Grouped values inside a binding
    if (this.Field.innerBinding) {
      this.bindings = this.bindings.filter(binding => !this.Field.binding.includes(binding))
    }

    const outerBindings = this.Field.innerBinding ? this.Field.binding : false
    let newParentValues = []

    if (outerBindings) {
      this.defaultBinding = this.Field.innerBinding[0]

      for (const outerBinding of outerBindings) {
        if (parentValues[outerBinding]) newParentValues.push(...parentValues[outerBinding])
      }  
    }
    else {
      newParentValues = parentValues
    }

    for (const binding of this.bindings) {
      const thisBindingValues = []
      const list = newParentValues?.[0]?.['@list'] ?? []

      for (const item of list) {
        if (item[binding]) {
          thisBindingValues.push(...item[binding])
        }
      }

      this.bindingValues.set(lastPart(binding), thisBindingValues)
    }
  }

  initDefault (parentValues) {
    this.defaultBinding = this.bindings[0]

    for (const binding of this.bindings) {
      this.bindingValues.set(lastPart(binding), parentValues[binding])
    }
  }

  _getValues (binding) {
    if (!binding) binding = this.defaultBinding
    binding = lastPart(binding)
    let values = this.bindingValues.get(binding)

    if (!values) {
      values = []
      this.bindingValues.set(binding, values)
    }

    return values
  }

  get (index = 0, binding = null) {
    const values = this._getValues(binding ?? this.defaultBinding)
    return values[index]
  }

  getValue (index = 0, binding = null) {
    const values = this._getValues(binding ?? this.defaultBinding)
    return values?.[index]?.['@' + this.jsonLdValueType] ?? null
  }

  set (value, index, binding = null) {
    const values = this._getValues(binding ?? this.defaultBinding)
    values[index] = value
  }

  setValue (innerValue, index, binding = null) {
    const values = this._getValues(binding ?? this.defaultBinding)
    if (!values[index]) values[index] = {}
    values[index]['@' + this.jsonLdValueType] = innerValue
  }

  get hasTranslations () {
    return !!this._getValues(this.defaultBinding).some(item => item?.['@language'])
  }

  get anotherTranslationIsPossible () {
    function onlyUnique(value, index, self) {
      return self.indexOf(value) === index;
    }

    const usedLanguages = this._getValues(this.defaultBinding).map(value => value?.['@language']).filter(onlyUnique)
    const l10nLanguagesCount = Object.keys(Language.l10nLanguages).length
    const filteredArray = usedLanguages.filter(value => Object.keys(Language.l10nLanguages).includes(value));
    const usedLanguagesCount = filteredArray.length
    return this.hasTranslations && (usedLanguagesCount < l10nLanguagesCount || this._getValues(this.defaultBinding).length > l10nLanguagesCount)
  }

  get length () {
    return this._getValues(this.defaultBinding).length
  }

  getAllFromBinding (binding = null) {
    return this._getValues(binding ?? this.defaultBinding)
  }

  getAll () {
    const allValues = {};
    [...this.bindingValues.keys()].forEach(binding => {
      allValues[binding] = this.getAllFromBinding(binding)
    })

    return allValues
  }

  addItem (binding = null) {
    const values = this._getValues(binding ?? this.defaultBinding)

    const createItem = () => {
      const newItem = {}
      newItem['@' + this.jsonLdValueType] = ''
      if (this.hasTranslations) newItem['@language'] = Language.currentL10nLanguage
      return newItem
    }

    values.push(createItem())
  }

  removeItem (index, binding = null) {
    const values = this._getValues(binding ?? this.defaultBinding)
    values.splice(index, 1)
  }

  // TODO support multi binding
  // TODO check if this does work.. 
  // this.bindingValues?.[index] looks wrong.
  enableTranslations () {
    const values = this._getValues(this.defaultBinding) ?? []

    let usedLanguages = this._getValues(this.defaultBinding).map(value => value['@language'])
    let unusedLanguages = Object.keys(Language.l10nLanguages).filter(language => !usedLanguages.includes(language))

    for (const [index, unusedLanguage] of unusedLanguages.entries()) {
      let value = values[index]
      if (typeof value === 'object') {
        values[index]['@language'] = unusedLanguage
      }
      else {
        values[index] = {
          '@value': this.bindingValues?.[index] ?? '',
          '@language': unusedLanguage
        }
      }
    }

    if (values.length > unusedLanguages.length) {
      for (let index = unusedLanguages.length; index <= values.length; index++) {
        let value = values[index]
        if (typeof value === 'object') {
          values[index]['@language'] = Language.current
        }
        else {
          values[index] = {
            '@value':  this.bindingValues?.[index] ?? '',
            '@language': Language.current
          }
        }
      }
    }
  }

  // TODO support multi binding
  removeTranslations () {
    let values = this._getValues(this.defaultBinding)
    delete values?.[0]?.['@language']
    values.splice(1)
  }

  /**
   * The serialize does not know about its children.
   * The child nesting logic happens inside the form.
   */
  async serialize (jsonLd) {
    // TODO For now we only support one outerBinding..
    let value: any = []
    let pointer = value

    const outerBinding = this.Field.innerBinding?.length ? this.Field.binding[0] : null

    if (this.isList) {
      const list = {'@list': []}
      pointer.push(list)
      pointer = list['@list']
    }

    const listValues = []
    for (const binding of this.bindings) {
      if (this.isGroup) continue;
      const values = this.getAllFromBinding(binding)
      for (const [index, bindingValue] of values.entries()) {
        if (this.isList) {
          if (!listValues[index]) listValues[index] = {}
          listValues[index][binding] = bindingValue
        }
        else {
          pointer.push(bindingValue)
        }
      }
    }

    if (this.isList) {
      pointer.push(...listValues)
    }

    jsonLd[outerBinding ?? this.defaultBinding] = value
  }

  getForChildElement (childField: FieldDefinition) {
    const values = this.getAllFromBinding()
    const childBinding = childField.binding[0] // TODO needs improvement? What if innerBinding?
    return { [childBinding]: values.flatMap(value => value?.[childBinding]) }
  }
}
