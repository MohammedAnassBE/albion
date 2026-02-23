<template>
	<BaseFormPage :config="config" :id="id" route="machine-gg" />
</template>

<script setup>
import BaseFormPage from '@/components/shared/BaseFormPage.vue'
import config from '@/config/fields/machine_gg'

defineProps({ id: { type: String, default: null } })
</script>
