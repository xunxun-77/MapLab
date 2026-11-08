<script setup>
import { computed, ref } from 'vue'
import { PROJECTIONS } from '../data/projections.js'

const props = defineProps({
  modelValue: { type: String, required: true },
})

const emit = defineEmits(['update:modelValue'])
const query = ref('')

const groups = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  const matches = PROJECTIONS.filter((projection) => {
    if (!keyword) return true
    return [projection.name, projection.en, projection.group, projection.property, projection.short]
      .join(' ')
      .toLowerCase()
      .includes(keyword)
  })
  return [...new Set(matches.map((projection) => projection.group))].map((group) => ({
    group,
    projections: matches.filter((projection) => projection.group === group),
  }))
})
</script>

<template>
  <aside class="projection-catalog" aria-label="投影方法">
    <div class="panel-heading">
      <div>
        <span class="eyebrow">PROJECTION LIBRARY</span>
        <h2>选择一种展开方式</h2>
      </div>
      <span class="count-badge">{{ PROJECTIONS.length }}</span>
    </div>

    <label class="search-field">
      <span class="sr-only">搜索投影</span>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="6.5" />
        <path d="m16 16 4 4" />
      </svg>
      <input v-model="query" type="search" placeholder="搜索名称、性质或类型" />
    </label>

    <div class="projection-groups">
      <section v-for="group in groups" :key="group.group" class="projection-group">
        <h3>{{ group.group }}投影</h3>
        <button
          v-for="projection in group.projections"
          :key="projection.id"
          type="button"
          class="projection-option"
          :class="{ active: projection.id === props.modelValue }"
          :aria-pressed="projection.id === props.modelValue"
          @click="emit('update:modelValue', projection.id)"
        >
          <span class="projection-option__number">{{ projection.no }}</span>
          <span class="projection-option__copy">
            <strong>{{ projection.name }}</strong>
            <small>{{ projection.en }}</small>
          </span>
          <span class="projection-option__property">{{ projection.property }}</span>
        </button>
      </section>
    </div>
  </aside>
</template>
