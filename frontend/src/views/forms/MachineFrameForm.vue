<template>
	<BaseFormPage :config="config" :id="id" route="machine-frame" />
</template>

<script setup>
import BaseFormPage from '@/components/shared/BaseFormPage.vue'
import config from '@/config/fields/machine_frame'

defineProps({ id: { type: String, default: null } })
</script>
