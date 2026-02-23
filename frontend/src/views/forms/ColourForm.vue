<template>
	<BaseFormPage :config="config" :id="id" route="colours" />
</template>

<script setup>
import BaseFormPage from '@/components/shared/BaseFormPage.vue'
import config from '@/config/fields/colour'

defineProps({ id: { type: String, default: null } })
</script>
