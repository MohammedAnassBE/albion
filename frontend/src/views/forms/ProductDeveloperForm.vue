<template>
	<BaseFormPage :config="config" :id="id" route="product-developers" />
</template>

<script setup>
import BaseFormPage from '@/components/shared/BaseFormPage.vue'
import config from '@/config/fields/product_developer'

defineProps({ id: { type: String, default: null } })
</script>
