<template>
	<BaseFormPage :config="config" :id="id" route="shift-allocations" />
</template>

<script setup>
import BaseFormPage from '@/components/shared/BaseFormPage.vue'
import config from '@/config/fields/shift_allocation'

defineProps({ id: { type: String, default: null } })
</script>
