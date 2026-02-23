<template>
	<BaseFormPage :config="config" :id="id" route="shifts" />
</template>

<script setup>
import BaseFormPage from '@/components/shared/BaseFormPage.vue'
import config from '@/config/fields/shift'

defineProps({ id: { type: String, default: null } })
</script>
