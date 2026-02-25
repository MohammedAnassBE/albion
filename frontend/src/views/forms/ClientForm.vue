<template>
	<BaseFormPage :config="config" :id="id" route="clients" />
</template>

<script setup>
import BaseFormPage from '@/components/shared/BaseFormPage.vue'
import config from '@/config/fields/client'

defineProps({ id: { type: String, default: null } })
</script>
