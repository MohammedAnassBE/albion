<template>
	<BaseFormPage :config="config" :id="id" route="machines" />
</template>

<script setup>
import BaseFormPage from '@/components/shared/BaseFormPage.vue'
import config from '@/config/fields/machine'

defineProps({ id: { type: String, default: null } })
</script>
