<template>
	<BaseFormPage :config="config" :id="id" route="customers" />
</template>

<script setup>
import BaseFormPage from '@/components/shared/BaseFormPage.vue'
import config from '@/config/fields/customer'

defineProps({ id: { type: String, default: null } })
</script>
