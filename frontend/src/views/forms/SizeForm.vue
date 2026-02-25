<template>
	<BaseFormPage :config="config" :id="id" route="sizes" />
</template>

<script setup>
import BaseFormPage from '@/components/shared/BaseFormPage.vue'
import config from '@/config/fields/size'

defineProps({ id: { type: String, default: null } })
</script>
