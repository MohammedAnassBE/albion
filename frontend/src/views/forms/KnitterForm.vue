<template>
	<BaseFormPage :config="config" :id="id" route="knitters" />
</template>

<script setup>
import BaseFormPage from '@/components/shared/BaseFormPage.vue'
import config from '@/config/fields/knitter'

defineProps({ id: { type: String, default: null } })
</script>
