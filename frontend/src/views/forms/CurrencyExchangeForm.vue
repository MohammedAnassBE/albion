<template>
	<BaseFormPage :config="config" :id="'Currency Exchange'" route="currency-exchange" />
</template>

<script setup>
import BaseFormPage from '@/components/shared/BaseFormPage.vue'
import config from '@/config/fields/currency_exchange'
</script>
