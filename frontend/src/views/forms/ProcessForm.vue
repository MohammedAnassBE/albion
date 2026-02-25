<template>
	<BaseFormPage :config="config" :id="id" route="processes" />
</template>

<script setup>
import BaseFormPage from '@/components/shared/BaseFormPage.vue'
import config from '@/config/fields/process'

defineProps({ id: { type: String, default: null } })
</script>
