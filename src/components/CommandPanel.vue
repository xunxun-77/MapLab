<script setup>
import { ref } from 'vue'
import { parseMapCommand, projectionName } from '../utils/commands.js'

const emit = defineEmits(['apply-command'])
const command = ref('对比阿尔伯斯和墨卡托在中国的变形')
const parsed = ref(null)

const examples = [
  '给中国全图选统计专题图投影',
  '对比温克尔三重和罗宾逊的全球轮廓',
  '用极地立体查看北极科考范围',
]

function runCommand(value = command.value) {
  command.value = value
  parsed.value = parseMapCommand(value)
  if (parsed.value.ok) emit('apply-command', parsed.value)
}
</script>

<template>
  <section class="control-section command-panel">
    <div class="section-title-row">
      <div>
        <span class="section-kicker">03 · 自然语言控制</span>
        <h3>一句话切换实验</h3>
      </div>
      <span class="mini-badge">模拟解析</span>
    </div>
    <label class="compact-field">
      <span>输入制图指令</span>
      <textarea v-model="command" rows="2"></textarea>
    </label>
    <button type="button" class="button button--dark button--block" @click="runCommand()">解析并应用</button>
    <div class="command-examples">
      <button v-for="example in examples" :key="example" type="button" @click="runCommand(example)">
        {{ example }}
      </button>
    </div>
    <div v-if="parsed" class="command-result" aria-live="polite">
      <strong>{{ parsed.message }}</strong>
      <span v-if="parsed.projections.length">
        投影：{{ parsed.projections.map(projectionName).join(' / ') }}
      </span>
      <span v-if="parsed.region">区域：{{ parsed.region }}</span>
      <span v-if="parsed.purpose">用途已同步到规则引擎</span>
    </div>
  </section>
</template>
