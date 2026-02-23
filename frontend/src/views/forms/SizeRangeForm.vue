<template>
	<BaseFormPage :config="config" :id="id" route="size-ranges" />
</template>

<script setup>
import BaseFormPage from '@/components/shared/BaseFormPage.vue'
import config from '@/config/fields/size_range'

defineProps({ id: { type: String, default: null } })
</script>
