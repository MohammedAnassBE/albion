<template>
	<BaseFormPage :config="config" :id="id" route="colour-nos" />
</template>

<script setup>
import BaseFormPage from '@/components/shared/BaseFormPage.vue'
import config from '@/config/fields/colour_no'

defineProps({ id: { type: String, default: null } })
</script>
